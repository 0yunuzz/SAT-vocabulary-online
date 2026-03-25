import { ReactNode } from "react";
import Link from "next/link";
import { UserRole } from "@prisma/client";
import { AppScreen } from "../types";
import type { StorageMode, SyncStatus } from "@/lib/types";

interface AppShellProps {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  mode: StorageMode;
  saveStatus: SyncStatus;
  userEmail?: string | null;
  userRole?: UserRole;
  children: ReactNode;
}

const navItems: Array<{ id: string; key: AppScreen; label: string }> = [
  { id: "dashboard", key: "dashboard", label: "Dashboard" },
  { id: "practice", key: "setup", label: "Practice" },
  { id: "review", key: "review", label: "Review" },
  { id: "library", key: "library", label: "Word Library" },
  { id: "statistics", key: "statistics", label: "Statistics" },
  { id: "achievements", key: "achievements", label: "Achievements" },
  { id: "settings", key: "settings", label: "Settings" },
];

const saveLabel: Record<SyncStatus, string> = {
  "guest-local": "Saved on this device",
  syncing: "Saving to account...",
  synced: "Account autosave on",
  "offline-pending": "Offline, will autosave when back online",
  error: "Account save issue"
};

export const AppShell = ({
  screen,
  onNavigate,
  mode,
  saveStatus,
  userEmail,
  userRole,
  children
}: AppShellProps) => {
  const classroomHome =
    userRole === UserRole.TEACHER
      ? "/teacher"
      : userRole === UserRole.ADMIN
        ? "/admin"
        : "/student";

  const assignmentRoute =
    userRole === UserRole.TEACHER ? "/teacher/assignments" : "/student/assignments";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-tag">SAT Prep</p>
          <h1>SAT Vocabulary Online</h1>
          <p className="brand-sub">Build SAT-ready vocabulary through focused practice, review, and measurable progress.</p>
        </div>

        <div className="mode-switcher panel-lite">
          <p className="small-note mode-label">Current Area</p>
          <span className="mode-pill active">Personal Study</span>
          {mode === "guest" ? (
            <Link href="/" className="mode-pill">
              Sign in for classroom assignments
            </Link>
          ) : (
            <>
              <Link href={classroomHome} className="mode-pill">
                Classroom Home
              </Link>
              {userRole !== UserRole.ADMIN ? (
                <Link href={assignmentRoute} className="mode-pill">
                  Assignments
                </Link>
              ) : null}
            </>
          )}
        </div>

        <nav className="main-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${screen === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-account">
          <p className="small-note">
            {mode === "guest" ? "Guest mode" : "Signed-in mode"} | {saveLabel[saveStatus]}
          </p>
          {userEmail ? <p className="small-note">{userEmail}</p> : null}
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
};
