import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { CreateClassForm } from "@/components/platform/CreateClassForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

export default async function TeacherClassesPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.TEACHER) redirect(roleHomePath(auth.role));

  const classes = await prisma.classroom.findMany({
    where: { teacherId: auth.userId },
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
  });

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Classes"
      subtitle="Create classes, share join codes, and manage class rosters."
    >
      <div className="dashboard-panels two-col">
        <CreateClassForm />
        <article className="panel">
          <h3>Join code flow</h3>
          <ol className="plain-list">
            <li>Create a class.</li>
            <li>Share the join code with students.</li>
            <li>Students join instantly without approval.</li>
            <li>Remove students anytime while preserving assignment history.</li>
          </ol>
        </article>
      </div>

      <article className="panel">
        <h3>Your classes</h3>
        {classes.length ? (
          <ul className="word-list">
            {classes.map((classroom) => (
              <li key={classroom.id}>
                <div>
                  <strong>{classroom.name}</strong>
                  <p className="small-note">
                    Join code: <code>{classroom.joinCode}</code>
                  </p>
                  <p className="small-note">
                    {classroom._count.memberships} students | {classroom._count.assignments} assignments
                  </p>
                </div>
                <Link className="btn secondary" href={`/teacher/classes/${classroom.id}`}>
                  Open class
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">No classes yet. Create one to start classroom assignments.</p>
        )}
      </article>
    </PortalShell>
  );
}
