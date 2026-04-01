import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { CreateAssignmentForm } from "@/components/platform/CreateAssignmentForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

export default async function TeacherAssignmentsPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.TEACHER) redirect(roleHomePath(auth.role));

  const [classes, assignments, words] = await Promise.all([
    prisma.classroom.findMany({
      where: { teacherId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true
      }
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
            id: true,
            submittedAt: true,
            submittedLate: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    prisma.word.findMany({
      select: {
        id: true,
        word: true,
        sourceGroup: true
      },
      orderBy: { word: "asc" },
      take: 1500
    })
  ]);

  const sourceGroups = Array.from(
    new Set(words.map((word) => word.sourceGroup).filter((value): value is string => Boolean(value)))
  );
  const openAssignmentCount = assignments.filter(
    (assignment) => !assignment.attempts.some((attempt) => attempt.submittedAt)
  ).length;

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Assignments"
      subtitle="Create and monitor homework for each class."
    >
      <section className="assignment-page">
        <div className="stats-grid">
          <article className="stat-card">
            <p className="stat-label">Total assignments</p>
            <p className="stat-value">{assignments.length}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Open assignments</p>
            <p className="stat-value">{openAssignmentCount}</p>
          </article>
          <article className="stat-card">
            <p className="stat-label">Classes</p>
            <p className="stat-value">{classes.length}</p>
          </article>
        </div>

        <div className="assignment-sections">
          <section className="assignment-section">
            {classes.length ? (
              <CreateAssignmentForm classes={classes} words={words} sourceGroups={sourceGroups} />
            ) : (
              <article className="panel">
                <h3>Create a class first</h3>
                <p>
                  Assignments are attached to classes. Create a class in the classes section
                  before creating your first assignment.
                </p>
                <Link className="btn primary" href="/teacher/classes">
                  Go to classes
                </Link>
              </article>
            )}
          </section>

          <section className="assignment-section">
            <article className="panel assignment-table-panel">
              <h3>Assignment list</h3>
              {assignments.length ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Class</th>
                      <th>Due</th>
                      <th>Mode</th>
                      <th>Submissions</th>
                      <th>Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((assignment) => {
                      const submissions = assignment.attempts.filter((attempt) => attempt.submittedAt);
                      const lateCount = assignment.attempts.filter(
                        (attempt) => attempt.submittedAt && attempt.submittedLate
                      ).length;

                      return (
                        <tr key={assignment.id}>
                          <td>
                            <Link href={`/teacher/assignments/${assignment.id}`}>
                              {assignment.title}
                            </Link>
                          </td>
                          <td>{assignment.classroom.name}</td>
                          <td>{assignment.dueAt.toLocaleString()}</td>
                          <td>{assignment.mode.replace("_", " ").toLowerCase()}</td>
                          <td>{submissions.length}</td>
                          <td>{lateCount}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <p className="empty-copy">No assignments created yet.</p>
              )}
            </article>
          </section>
        </div>
      </section>
    </PortalShell>
  );
}
