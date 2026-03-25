import Link from "next/link";
import { UserRole } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { RegenerateJoinCodeButton } from "@/components/platform/RegenerateJoinCodeButton";
import { RemoveStudentButton } from "@/components/platform/RemoveStudentButton";
import { CreateAssignmentForm } from "@/components/platform/CreateAssignmentForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { autoSubmitOverdueAttemptsForAssignment } from "@/lib/classroom";

interface TeacherClassDetailPageProps {
  params: Promise<{ classId: string }>;
}

export default async function TeacherClassDetailPage({
  params
}: TeacherClassDetailPageProps) {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.TEACHER) redirect(roleHomePath(auth.role));

  const { classId } = await params;

  const classroom = await prisma.classroom.findFirst({
    where: {
      id: classId,
      teacherId: auth.userId
    },
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
        },
        orderBy: [{ removedAt: "asc" }, { joinedAt: "desc" }]
      },
      assignments: {
        orderBy: { createdAt: "desc" },
        include: {
          attempts: {
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
      }
    }
  });

  if (!classroom) notFound();

  for (const assignment of classroom.assignments) {
    await autoSubmitOverdueAttemptsForAssignment(assignment.id);
  }

  const wordCatalog = await prisma.word.findMany({
    select: { id: true, word: true, sourceGroup: true },
    orderBy: { word: "asc" },
    take: 1500
  });
  const sourceGroups = Array.from(
    new Set(wordCatalog.map((word) => word.sourceGroup).filter((value): value is string => Boolean(value)))
  );

  const activeMembers = classroom.memberships.filter((membership) => !membership.removedAt);
  const historicalMembers = classroom.memberships.filter((membership) => membership.removedAt);

  const performanceByStudent = new Map<
    string,
    {
      name: string;
      email: string | null;
      submitted: number;
      totalAssignments: number;
      firstTryCorrect: number;
      finalCorrect: number;
      totalQuestions: number;
      questionsCompleted: number;
      timeSpentSec: number;
      latestSubmittedAt: Date | null;
    }
  >();

  for (const assignment of classroom.assignments) {
    for (const attempt of assignment.attempts) {
      const key = attempt.studentId;
      const existing = performanceByStudent.get(key) ?? {
        name: attempt.student.name ?? "Student",
        email: attempt.student.email,
        submitted: 0,
        totalAssignments: 0,
        firstTryCorrect: 0,
        finalCorrect: 0,
        totalQuestions: 0,
        questionsCompleted: 0,
        timeSpentSec: 0,
        latestSubmittedAt: null
      };

      existing.totalAssignments += 1;
      existing.firstTryCorrect += attempt.firstTryCorrect;
      existing.finalCorrect += attempt.finalCorrect;
      existing.totalQuestions += attempt.totalQuestions;
      existing.questionsCompleted += attempt.questionsCompleted;
      existing.timeSpentSec += Math.round(attempt.totalResponseMs / 1000);

      if (attempt.submittedAt) {
        existing.submitted += 1;
        if (!existing.latestSubmittedAt || attempt.submittedAt > existing.latestSubmittedAt) {
          existing.latestSubmittedAt = attempt.submittedAt;
        }
      }

      performanceByStudent.set(key, existing);
    }
  }

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title={classroom.name}
      subtitle="Roster, join code, and class performance"
    >
      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Join code</h3>
          <p className="small-note">Students can join instantly with this code.</p>
          <p className="join-code">{classroom.joinCode}</p>
          <RegenerateJoinCodeButton classId={classroom.id} />
        </article>
        <CreateAssignmentForm
          classes={[{ id: classroom.id, name: classroom.name }]}
          words={wordCatalog}
          sourceGroups={sourceGroups}
          defaultClassId={classroom.id}
        />
      </div>

      <article className="panel">
        <h3>Active roster</h3>
        {activeMembers.length ? (
          <ul className="word-list">
            {activeMembers.map((membership) => (
              <li key={membership.id}>
                <div>
                  <strong>{membership.student.name ?? membership.student.email}</strong>
                  <p className="small-note">{membership.student.email}</p>
                  <p className="small-note">
                    Joined {membership.joinedAt.toLocaleDateString()}
                  </p>
                </div>
                <RemoveStudentButton classId={classroom.id} studentId={membership.studentId} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No students enrolled yet.</p>
        )}
      </article>

      {historicalMembers.length ? (
        <article className="panel">
          <h3>Removed students</h3>
          <ul className="word-list">
            {historicalMembers.map((membership) => (
              <li key={membership.id}>
                <div>
                  <strong>{membership.student.name ?? membership.student.email}</strong>
                  <p className="small-note">{membership.student.email}</p>
                </div>
                <span className="pill weak">removed</span>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      <article className="panel">
        <h3>Assignments</h3>
        {classroom.assignments.length ? (
          <ul className="word-list">
            {classroom.assignments.map((assignment) => (
              <li key={assignment.id}>
                <div>
                  <strong>{assignment.title}</strong>
                  <p className="small-note">Due {assignment.dueAt.toLocaleString()}</p>
                  <p className="small-note">
                    {assignment.attempts.filter((attempt) => attempt.submittedAt).length} submissions
                  </p>
                </div>
                <Link className="btn secondary" href={`/teacher/assignments/${assignment.id}`}>
                  View analytics
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No assignments created for this class yet.</p>
        )}
      </article>

      <article className="panel">
        <h3>Per-student class performance</h3>
        {performanceByStudent.size ? (
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Completion</th>
                <th>First-try accuracy</th>
                <th>Final accuracy</th>
                <th>Time spent</th>
                <th>Questions completed</th>
                <th>Last submission</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(performanceByStudent.entries()).map(([studentId, stats]) => {
                const firstTryAccuracy =
                  stats.totalQuestions > 0
                    ? Math.round((stats.firstTryCorrect / stats.totalQuestions) * 1000) / 10
                    : 0;
                const finalAccuracy =
                  stats.totalQuestions > 0
                    ? Math.round((stats.finalCorrect / stats.totalQuestions) * 1000) / 10
                    : 0;
                return (
                  <tr key={studentId}>
                    <td>{stats.name}</td>
                    <td>
                      {stats.submitted}/{stats.totalAssignments}
                    </td>
                    <td>{firstTryAccuracy}%</td>
                    <td>{finalAccuracy}%</td>
                    <td>{stats.timeSpentSec}s</td>
                    <td>{stats.questionsCompleted}</td>
                    <td>
                      {stats.latestSubmittedAt
                        ? stats.latestSubmittedAt.toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="empty-copy">Performance data appears once assignments are attempted.</p>
        )}
      </article>
    </PortalShell>
  );
}
