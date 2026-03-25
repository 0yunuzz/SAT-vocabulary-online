import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/authz";
import { roleHomePath } from "@/lib/navigation";
import { RoleSignInButtons } from "@/components/platform/RoleSignInButtons";

export default async function HomePage() {
  const auth = await getAuthContext();
  if (auth) {
    if (!auth.roleSelectedAt && auth.role !== UserRole.ADMIN) {
      redirect("/welcome");
    }
    redirect(roleHomePath(auth.role));
  }

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <p className="landing-eyebrow">SAT Vocabulary Platform</p>
        <h1>Independent mastery and classroom homework in one streamlined app.</h1>
        <p className="landing-sub">
          Students can study instantly in guest mode or sign in for synced progress.
          Teachers can create classes, assign controlled homework, and track outcomes.
        </p>
        <div className="landing-cta-row">
          <Link href="/study" className="btn primary">
            Continue as Guest Student
          </Link>
          <RoleSignInButtons />
        </div>
      </section>

      <section className="landing-grid">
        <article className="panel landing-card">
          <h3>Guest Student</h3>
          <p>Jump directly into personal SAT vocab study with local-only progress.</p>
        </article>
        <article className="panel landing-card">
          <h3>Student Account</h3>
          <p>Join classes, complete assignments, and sync independent mastery.</p>
        </article>
        <article className="panel landing-card">
          <h3>Teacher Account</h3>
          <p>Create classes, assign homework, monitor completion, and review performance.</p>
        </article>
      </section>
    </main>
  );
}
