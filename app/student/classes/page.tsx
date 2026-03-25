import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/platform/PortalShell";
import { JoinClassForm } from "@/components/platform/JoinClassForm";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { prisma } from "@/lib/prisma";

export default async function StudentClassesPage() {
  const auth = await getAuthContext();
  if (!auth) redirect("/");
  if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) redirect("/welcome");
  if (auth.role !== UserRole.STUDENT) redirect(roleHomePath(auth.role));

  const memberships = await prisma.classMembership.findMany({
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
          },
          assignments: {
            where: {
              dueAt: {
                gte: new Date()
              }
            },
            take: 3,
            orderBy: { dueAt: "asc" },
            select: {
              id: true,
              title: true,
              dueAt: true
            }
          }
        }
      }
    },
    orderBy: { joinedAt: "desc" }
  });

  return (
    <PortalShell
      role={auth.role}
      userName={auth.name}
      userEmail={auth.email}
      title="Your Classes"
      subtitle="Join classes by code and keep track of active class spaces."
    >
      <JoinClassForm />

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
                  <p className="small-note">Join code: {membership.classroom.joinCode}</p>
                  {membership.classroom.assignments.length ? (
                    <p className="small-note">
                      Upcoming:{" "}
                      {membership.classroom.assignments
                        .map((assignment) => assignment.title)
                        .join(", ")}
                    </p>
                  ) : (
                    <p className="small-note">No upcoming assignments yet.</p>
                  )}
                </div>
                <Link className="text-button" href="/student/assignments">
                  View assignments
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-copy">
            No classes joined yet. Enter a class code above to get started.
          </p>
        )}
      </article>
    </PortalShell>
  );
}
