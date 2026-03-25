import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { AdminRoleSelector } from "@/components/platform/AdminRoleSelector";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/roles";

export default async function AdminDashboardPage() {
  const auth = await requireRole([UserRole.ADMIN]);

  const [studentsCount, teachersCount, adminsCount, classCount, assignmentCount, users, classes, assignments] =
    await Promise.all([
      prisma.user.count({ where: { role: UserRole.STUDENT } }),
      prisma.user.count({ where: { role: UserRole.TEACHER } }),
      prisma.user.count({ where: { role: UserRole.ADMIN } }),
      prisma.classroom.count(),
      prisma.assignment.count(),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          roleSelectedAt: true,
          createdAt: true
        }
      }),
      prisma.classroom.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          teacher: {
            select: {
              name: true,
              email: true
            }
          },
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
        }
      }),
      prisma.assignment.findMany({
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          classroom: {
            select: {
              name: true
            }
          },
          teacher: {
            select: {
              name: true,
              email: true
            }
          },
          attempts: {
            select: {
              submittedAt: true,
              finalCorrect: true,
              totalQuestions: true
            }
          }
        }
      })
    ]);

  if (!auth.roleSelectedAt) {
    redirect("/welcome");
  }

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Admin Oversight"
      subtitle="Platform-level monitoring, role inspection, and operational visibility."
    >
      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Students</p>
          <p className="stat-value">{studentsCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Teachers</p>
          <p className="stat-value">{teachersCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Admin accounts</p>
          <p className="stat-value">{adminsCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Classes</p>
          <p className="stat-value">{classCount}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Assignments</p>
          <p className="stat-value">{assignmentCount}</p>
        </article>
      </div>

      <article className="panel">
        <h3>User role management</h3>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Current role</th>
              <th>Role selected</th>
              <th>Created</th>
              <th>Update role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name ?? "-"}</td>
                <td>{user.email ?? "-"}</td>
                <td>{user.role.toLowerCase()}</td>
                <td>{user.roleSelectedAt ? user.roleSelectedAt.toLocaleString() : "-"}</td>
                <td>{user.createdAt.toLocaleDateString()}</td>
                <td>
                  <AdminRoleSelector
                    userId={user.id}
                    email={user.email}
                    role={user.role}
                    locked={isAdminEmail(user.email)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel">
        <h3>Class oversight</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Teacher</th>
              <th>Join code</th>
              <th>Students</th>
              <th>Assignments</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((classroom) => (
              <tr key={classroom.id}>
                <td>{classroom.name}</td>
                <td>{classroom.teacher.name ?? classroom.teacher.email}</td>
                <td>{classroom.joinCode}</td>
                <td>{classroom._count.memberships}</td>
                <td>{classroom._count.assignments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="panel">
        <h3>Assignment completion and performance</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Assignment</th>
              <th>Class</th>
              <th>Teacher</th>
              <th>Due</th>
              <th>Submitted</th>
              <th>Avg final accuracy</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const submitted = assignment.attempts.filter((attempt) => attempt.submittedAt);
              const avgAccuracy =
                submitted.length > 0
                  ? Math.round(
                      (submitted.reduce((sum, attempt) => {
                        const total = Math.max(attempt.totalQuestions, 1);
                        return sum + (attempt.finalCorrect / total) * 100;
                      }, 0) /
                        submitted.length) *
                        10
                    ) / 10
                  : 0;
              return (
                <tr key={assignment.id}>
                  <td>{assignment.title}</td>
                  <td>{assignment.classroom.name}</td>
                  <td>{assignment.teacher.name ?? assignment.teacher.email}</td>
                  <td>{assignment.dueAt.toLocaleString()}</td>
                  <td>{submitted.length}</td>
                  <td>{submitted.length ? `${avgAccuracy}%` : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </article>
    </PortalShell>
  );
}
