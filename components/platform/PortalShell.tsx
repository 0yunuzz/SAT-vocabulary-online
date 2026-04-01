"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { UserRole } from "@prisma/client";

interface PortalShellProps {
  role: UserRole;
  userName?: string | null;
  userEmail?: string | null;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

interface NavItem {
  href: string;
  label: string;
}

const studentNav: NavItem[] = [
  { href: "/student", label: "Dashboard" },
  { href: "/student/classes", label: "Classes" },
  { href: "/student/assignments", label: "Assignments" }
];

const teacherNav: NavItem[] = [
  { href: "/teacher", label: "Dashboard" },
  { href: "/teacher/classes", label: "Classes" },
  { href: "/teacher/assignments", label: "Assignments" }
];

const adminNav: NavItem[] = [
  { href: "/admin", label: "Admin Overview" }
];

function roleNav(role: UserRole): NavItem[] {
  if (role === UserRole.TEACHER) return teacherNav;
  if (role === UserRole.ADMIN) return adminNav;
  return studentNav;
}

function roleLabel(role: UserRole): string {
  if (role === UserRole.TEACHER) return "Teacher";
  if (role === UserRole.ADMIN) return "Admin";
  return "Student";
}

function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/student" && href !== "/teacher" && pathname.startsWith(`${href}/`));
}

export function PortalShell({
  role,
  userName,
  userEmail,
  title,
  subtitle,
  children
}: PortalShellProps) {
  const pathname = usePathname();
  const nav = roleNav(role);
  const classroomDashboardHref =
    role === UserRole.TEACHER ? "/teacher" : role === UserRole.ADMIN ? "/admin" : "/student";
  const classroomLabel =
    role === UserRole.STUDENT ? "Student Dashboard" : role === UserRole.TEACHER ? "Teacher Dashboard" : "Admin Dashboard";

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <p className="portal-tag">SAT Vocabulary Platform</p>
          <h1>Classroom + Study</h1>
          <p>{roleLabel(role)} Workspace</p>
        </div>

        <div className="mode-switcher">
          <Link href="/study" className="mode-pill">
            Personal Dashboard
          </Link>
          <Link href={classroomDashboardHref} className="mode-pill active">
            {classroomLabel}
          </Link>
        </div>

        <nav className="portal-nav" aria-label="Workspace">
          {nav.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                className={`portal-nav-item ${active ? "active" : ""}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="portal-account">
          <p className="small-note">{userName ?? "Signed in user"}</p>
          {userEmail ? <p className="small-note">{userEmail}</p> : null}
          <button
            type="button"
            className="btn ghost"
            onClick={() => void signOut({ callbackUrl: "/" })}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="portal-main">
        <header className="portal-page-head">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </header>
        <section className="portal-content">{children}</section>
      </main>
    </div>
  );
}
