import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";
import { getAccountSnapshot } from "@/lib/db-progress";
import {
  autoSubmitOverdueAttemptsForStudent,
  getAssignmentStatus
} from "@/lib/classroom";

export default async function StudentDashboardPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.STUDENT) redirect(roleHomePath(auth.role));

  await autoSubmitOverdueAttemptsForStudent(auth.userId);

  const [memberships, assignments, snapshot] = await Promise.all([
    prisma.classMembership.findMany({
      where: {
        studentId: auth.userId,
        removedAt: null
      },
      include: {
        classroom: {
          include: {
            teacher: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: { joinedAt: "desc" }
    }),
    prisma.assignment.findMany({
      where: {
        OR: [
          {
            classroom: {
              memberships: {
                some: {
                  studentId: auth.userId,
                  removedAt: null
                }
              }
            }
          },
          {
            attempts: {
              some: {
                studentId: auth.userId
              }
            }
          }
        ]
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true
          }
        },
        attempts: {
          where: {
            studentId: auth.userId
          },
          take: 1
        }
      },
      orderBy: { dueAt: "asc" }
    }),
    getAccountSnapshot(auth.userId)
  ]);

  const assignmentRows = assignments.map((assignment) => {
    const attempt = assignment.attempts[0];
    const status = getAssignmentStatus({
      dueAt: assignment.dueAt,
      allowLateSubmissions: assignment.allowLateSubmissions,
      startedAt: attempt?.startedAt,
      submittedAt: attempt?.submittedAt,
      submittedLate: attempt?.submittedLate
    });
    return { assignment, attempt, status };
  });

  const now = Date.now();
  const active = assignmentRows.filter(
    (row) => row.status === "not started" || row.status === "in progress"
  );
  const dueSoon = assignmentRows.filter((row) => {
    if (row.status === "submitted late" || row.status === "submitted on time") return false;
    const dueMs = row.assignment.dueAt.getTime();
    return dueMs >= now && dueMs - now <= 3 * 24 * 60 * 60 * 1000;
  });
  const overdue = assignmentRows.filter((row) => row.status === "overdue");
  const past = assignmentRows.filter(
    (row) => row.status === "submitted late" || row.status === "submitted on time"
  );

  const progressValues = Object.values(snapshot.wordProgress);
  const masteredCount = progressValues.filter((item) => item.masteryScore >= 80).length;

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Student Dashboard"
      subtitle="Personal study and classroom assignments in one view."
    >
      <div className="stats-grid">
        <article className="stat-card">
          <div>
            <p className="stat-label">Joined Classes</p>
            <p className="stat-value">{memberships.length}</p>
          </div>
        </article>
        <article className="stat-card">
          <div>
            <p className="stat-label">Active Assignments</p>
            <p className="stat-value">{active.length}</p>
          </div>
        </article>
        <article className="stat-card">
          <div>
            <p className="stat-label">Overdue</p>
            <p className="stat-value">{overdue.length}</p>
          </div>
        </article>
        <article className="stat-card">
          <div>
            <p className="stat-label">Mastered Words</p>
            <p className="stat-value">{masteredCount}</p>
            <p className="small-note">from personal independent study</p>
          </div>
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <div className="panel-head-row">
            <h3>Personal study</h3>
            <Link className="text-button" href="/study">
              Open study engine
            </Link>
          </div>
          <p>
            Your private independent study stays private from teachers. Assignment
            outcomes still improve personal mastery internally.
          </p>
          <ul className="metric-list">
            <li>
              <span>Tracked words</span>
              <strong>{progressValues.length}</strong>
            </li>
            <li>
              <span>Study sessions</span>
              <strong>{snapshot.sessions.length}</strong>
            </li>
            <li>
              <span>Current streak</span>
              <strong>{snapshot.streak.currentStreak}</strong>
            </li>
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head-row">
            <h3>Due soon</h3>
            <Link className="text-button" href="/student/assignments">
              View all assignments
            </Link>
          </div>
          {dueSoon.length ? (
            <ul className="word-list">
              {dueSoon.slice(0, 6).map((row) => (
                <li key={row.assignment.id}>
                  <div>
                    <strong>{row.assignment.title}</strong>
                    <p className="small-note">{row.assignment.classroom.name}</p>
                  </div>
                  <div>
                    <p>{new Date(row.assignment.dueAt).toLocaleString()}</p>
                    <span className="pill learning">{row.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No assignments due in the next 3 days.</p>
          )}
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Joined classes</h3>
          {memberships.length ? (
            <ul className="word-list">
              {memberships.map((membership) => (
                <li key={membership.id}>
                  <div>
                    <strong>{membership.classroom.name}</strong>
                    <p className="small-note">
                      Teacher: {membership.classroom.teacher.name ?? membership.classroom.teacher.email}
                    </p>
                  </div>
                  <code>{membership.classroom.joinCode}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">
              You have not joined any classes yet. Use a class code to join instantly.
            </p>
          )}
        </article>

        <article className="panel">
          <h3>Past submissions</h3>
          {past.length ? (
            <ul className="word-list">
              {past.slice(0, 8).map((row) => (
                <li key={row.assignment.id}>
                  <div>
                    <strong>{row.assignment.title}</strong>
                    <p className="small-note">{row.assignment.classroom.name}</p>
                  </div>
                  <span className={`pill ${row.status.includes("late") ? "weak" : "mastered"}`}>
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No submitted assignments yet.</p>
          )}
        </article>
      </div>
    </PortalShell>
  );
}
