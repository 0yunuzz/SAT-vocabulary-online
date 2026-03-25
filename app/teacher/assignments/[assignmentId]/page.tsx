import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { AssignmentSettingsForm } from "@/components/platform/AssignmentSettingsForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import {
  autoSubmitOverdueAttemptsForAssignment,
  getAssignmentStatus
} from "@/lib/classroom";

interface TeacherAssignmentDetailPageProps {
  params: Promise<{ assignmentId: string }>;
}

export default async function TeacherAssignmentDetailPage({
  params
}: TeacherAssignmentDetailPageProps) {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.TEACHER) redirect(roleHomePath(auth.role));

  const { assignmentId } = await params;
  await autoSubmitOverdueAttemptsForAssignment(assignmentId);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      teacherId: auth.userId
    },
    include: {
      classroom: {
        include: {
          memberships: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          }
        }
      },
      questions: {
        select: {
          id: true
        }
      },
      attempts: {
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { updatedAt: "desc" }
      }
    }
  });

  if (!assignment) notFound();

  const rosterByStudentId = new Map(
    assignment.classroom.memberships.map((membership) => [membership.studentId, membership])
  );
  const seen = new Set<string>();
  const students = assignment.classroom.memberships.map((membership) => membership.student);

  for (const attempt of assignment.attempts) {
    if (seen.has(attempt.studentId)) continue;
    seen.add(attempt.studentId);
    if (!rosterByStudentId.has(attempt.studentId)) {
      students.push(attempt.student);
    }
  }

  const attemptByStudentId = new Map(
    assignment.attempts.map((attempt) => [attempt.studentId, attempt])
  );

  const totalQuestions = Math.max(assignment.questionCount, 1);

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title={assignment.title}
      subtitle={`${assignment.classroom.name} assignment analytics`}
    >
      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Questions</p>
          <p className="stat-value">{assignment.questionCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Mode</p>
          <p className="stat-value">{assignment.mode.replace("_", " ").toLowerCase()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Due</p>
          <p className="stat-value">{assignment.dueAt.toLocaleDateString()}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Late submissions</p>
          <p className="stat-value">{assignment.allowLateSubmissions ? "on" : "off"}</p>
        </article>
      </div>

      <AssignmentSettingsForm
        assignmentId={assignment.id}
        dueAtIso={assignment.dueAt.toISOString()}
        instructions={assignment.instructions}
        allowLateSubmissions={assignment.allowLateSubmissions}
      />

      <article className="panel">
        <h3>Per-student assignment analytics</h3>
        <p className="small-note">
          Teachers only see class assignment performance. Private independent study data
          is not shown.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Status</th>
              <th>First-try accuracy</th>
              <th>Final accuracy</th>
              <th>Time spent</th>
              <th>Questions completed</th>
              <th>Submission timestamp</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const attempt = attemptByStudentId.get(student.id);
              const status = getAssignmentStatus({
                dueAt: assignment.dueAt,
                allowLateSubmissions: assignment.allowLateSubmissions,
                startedAt: attempt?.startedAt,
                submittedAt: attempt?.submittedAt,
                submittedLate: attempt?.submittedLate
              });
              const firstTryAccuracy =
                attempt?.firstTryCorrect !== undefined
                  ? Math.round((attempt.firstTryCorrect / totalQuestions) * 1000) / 10
                  : 0;
              const finalAccuracy =
                attempt?.finalCorrect !== undefined
                  ? Math.round((attempt.finalCorrect / totalQuestions) * 1000) / 10
                  : 0;

              return (
                <tr key={student.id}>
                  <td>{student.name ?? student.email}</td>
                  <td>{status}</td>
                  <td>{attempt ? `${firstTryAccuracy}%` : "-"}</td>
                  <td>{attempt ? `${finalAccuracy}%` : "-"}</td>
                  <td>{attempt ? `${Math.round(attempt.totalResponseMs / 1000)}s` : "-"}</td>
                  <td>{attempt ? `${attempt.questionsCompleted}/${attempt.totalQuestions}` : "-"}</td>
                  <td>{attempt?.submittedAt ? attempt.submittedAt.toLocaleString() : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </PortalShell>
  );
}
