import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import {
  autoSubmitOverdueAttemptsForStudent,
  getAssignmentStatus
} from "@/lib/classroom";

export default async function StudentAssignmentsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.STUDENT) redirect(roleHomePath(auth.role));

  const hasOverdue = await prisma.assignmentAttempt.findFirst({
    where: {
      studentId: auth.userId,
      startedAt: { not: null },
      submittedAt: null,
      assignment: {
        allowLateSubmissions: false,
        dueAt: { lt: new Date() }
      }
    },
    select: { id: true }
  });
  if (hasOverdue) {
    await autoSubmitOverdueAttemptsForStudent(auth.userId);
  }

  const [membershipRows, attempts] = await Promise.all([
    prisma.classMembership.findMany({
      where: {
        studentId: auth.userId,
        removedAt: null
      },
      select: {
        classId: true
      }
    }),
    prisma.assignmentAttempt.findMany({
      where: {
        studentId: auth.userId
      },
      select: {
        assignmentId: true,
        startedAt: true,
        submittedAt: true,
        submittedLate: true
      }
    })
  ]);

  const classIds = membershipRows.map((membership) => membership.classId);
  const attemptByAssignmentId = new Map(
    attempts.map((attempt) => [attempt.assignmentId, attempt])
  );
  const attemptedAssignmentIds = attempts.map((attempt) => attempt.assignmentId);

  const whereClauses: Array<Record<string, unknown>> = [];
  if (classIds.length) {
    whereClauses.push({ classId: { in: classIds } });
  }
  if (attemptedAssignmentIds.length) {
    whereClauses.push({ id: { in: attemptedAssignmentIds } });
  }

  const assignments =
    whereClauses.length > 0
      ? await prisma.assignment.findMany({
          where: {
            OR: whereClauses
          },
          select: {
            id: true,
            title: true,
            dueAt: true,
            allowLateSubmissions: true,
            classroom: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }]
        })
      : [];

  const rows = assignments.map((assignment) => {
    const attempt = attemptByAssignmentId.get(assignment.id);
    const status = getAssignmentStatus({
      dueAt: assignment.dueAt,
      allowLateSubmissions: assignment.allowLateSubmissions,
      startedAt: attempt?.startedAt,
      submittedAt: attempt?.submittedAt,
      submittedLate: attempt?.submittedLate
    });
    return { assignment, attempt, status };
  });

  const active = rows.filter(
    (row) => row.status === "not started" || row.status === "in progress"
  );
  const overdue = rows.filter((row) => row.status === "overdue");
  const past = rows.filter(
    (row) => row.status === "submitted on time" || row.status === "submitted late"
  );

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Assignments"
      subtitle="Track active homework, due dates, and completed submissions."
    >
      <section className="assignment-page">
        <div className="stats-grid">
          <article className="stat-card">
            <p className="stat-label">Active</p>
            <p className="stat-value">{active.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Overdue</p>
            <p className="stat-value">{overdue.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Submitted</p>
            <p className="stat-value">{past.length}</p>
          </article>
        </div>

        <div className="assignment-sections">
          <section className="assignment-section">
            <article className="panel">
              <h3>Active and upcoming</h3>
              {active.length ? (
                <ul className="word-list">
                  {active.map((row) => (
                    <li key={row.assignment.id}>
                      <div>
                        <strong>{row.assignment.title}</strong>
                        <p className="small-note">{row.assignment.classroom.name}</p>
                        <p className="small-note">Due {new Date(row.assignment.dueAt).toLocaleString()}</p>
                      </div>
                      <div className="library-meta">
                        <span className="pill learning">{row.status}</span>
                        <Link
                          className="btn secondary"
                          href={`/student/assignments/${row.assignment.id}`}
                        >
                          Open
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy">No active assignments right now.</p>
              )}
            </article>
          </section>

          <section className="assignment-section">
            <article className="panel">
              <h3>Completed and overdue history</h3>
              {past.length || overdue.length ? (
                <ul className="word-list">
                  {[...overdue, ...past].map((row) => (
                    <li key={row.assignment.id}>
                      <div>
                        <strong>{row.assignment.title}</strong>
                        <p className="small-note">{row.assignment.classroom.name}</p>
                        <p className="small-note">
                          {row.attempt?.submittedAt
                            ? `Submitted ${new Date(row.attempt.submittedAt).toLocaleString()}`
                            : `Due ${new Date(row.assignment.dueAt).toLocaleString()}`}
                        </p>
                      </div>
                      <span className={`pill ${row.status.includes("late") || row.status === "overdue" ? "weak" : "mastered"}`}>
                        {row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy">No completed assignments yet.</p>
              )}
            </article>
          </section>
        </div>
      </section>
    </PortalShell>
  );
}
