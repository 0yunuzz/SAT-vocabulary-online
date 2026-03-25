import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { CreateClassForm } from "@/components/platform/CreateClassForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

export default async function TeacherDashboardPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.TEACHER) redirect(roleHomePath(auth.role));

  const [classes, assignments] = await Promise.all([
    prisma.classroom.findMany({
      where: {
        teacherId: auth.userId
      },
      include: {
        _count: {
          select: {
            memberships: {
              where: {
                removedAt: null
              }
            },
            assignments: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.assignment.findMany({
      where: {
        teacherId: auth.userId
      },
      include: {
        classroom: {
          select: {
            id: true,
            name: true
          }
        },
        attempts: {
          select: {
            submittedAt: true,
            submittedLate: true,
            finalCorrect: true,
            totalQuestions: true
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20
    })
  ]);

  const activeStudents = classes.reduce(
    (sum, classroom) => sum + classroom._count.memberships,
    0
  );
  const totalAssignments = classes.reduce(
    (sum, classroom) => sum + classroom._count.assignments,
    0
  );

  const assignmentRows = assignments.map((assignment) => {
    const submissions = assignment.attempts.filter((attempt) => attempt.submittedAt);
    const onTime = submissions.filter((attempt) => !attempt.submittedLate).length;
    const avgAccuracy =
      submissions.length > 0
        ? Math.round(
            (submissions.reduce((sum, attempt) => {
              const total = Math.max(attempt.totalQuestions, 1);
              return sum + (attempt.finalCorrect / total) * 100;
            }, 0) /
              submissions.length) *
              10
          ) / 10
        : 0;

    return {
      id: assignment.id,
      title: assignment.title,
      className: assignment.classroom.name,
      dueAt: assignment.dueAt,
      totalSubmissions: submissions.length,
      onTime,
      avgAccuracy
    };
  });

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Teacher Dashboard"
      subtitle="Manage classes, create assignments, and track class-level outcomes."
    >
      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Classes</p>
          <p className="stat-value">{classes.length}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Active Students</p>
          <p className="stat-value">{activeStudents}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Assignments</p>
          <p className="stat-value">{totalAssignments}</p>
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <CreateClassForm />
        <article className="panel">
          <h3>Classroom quick links</h3>
          {classes.length ? (
            <ul className="word-list">
              {classes.slice(0, 6).map((classroom) => (
                <li key={classroom.id}>
                  <div>
                    <strong>{classroom.name}</strong>
                    <p className="small-note">
                      {classroom._count.memberships} students | {classroom._count.assignments} assignments
                    </p>
                  </div>
                  <Link className="text-button" href={`/teacher/classes/${classroom.id}`}>
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No classes yet. Create your first class to start assigning homework.</p>
          )}
        </article>
      </div>

      <article className="panel">
        <div className="panel-head-row">
          <h3>Assignment overview</h3>
          <Link className="text-button" href="/teacher/assignments">
            Manage assignments
          </Link>
        </div>
        {assignmentRows.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Class</th>
                <th>Due</th>
                <th>Submissions</th>
                <th>On-time</th>
                <th>Avg accuracy</th>
              </tr>
            </thead>
            <tbody>
              {assignmentRows.slice(0, 10).map((row) => (
                <tr key={row.id}>
                  <td>
                    <Link href={`/teacher/assignments/${row.id}`}>{row.title}</Link>
                  </td>
                  <td>{row.className}</td>
                  <td>{new Date(row.dueAt).toLocaleString()}</td>
                  <td>{row.totalSubmissions}</td>
                  <td>{row.onTime}</td>
                  <td>{row.avgAccuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-copy">Assignments will appear here after you create them.</p>
        )}
      </article>
    </PortalShell>
  );
}
