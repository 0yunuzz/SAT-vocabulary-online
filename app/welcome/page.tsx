import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { RoleChooser } from "@/components/platform/RoleChooser";

interface WelcomePageProps {
  searchParams: Promise<{ intent?: string }>;
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const auth = await getAuthContext();
  if (!auth) {
    redirect("/");
  }

  if (auth.role === UserRole.ADMIN) {
    redirect("/admin");
  }

  if (auth.roleSelectedAt) {
    redirect(roleHomePath(auth.role));
  }

  const params = await searchParams;
  const suggestedRole = params.intent === "teacher" ? "TEACHER" : "STUDENT";

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Finish account setup</h1>
        <RoleChooser suggestedRole={suggestedRole} />
      </div>
    </main>
  );
}
