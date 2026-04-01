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
  { id: "review", key: "review", label: "Review" }
];

const saveLabel: Record<SyncStatus, string> = {
  "guest-local": "Saved on this device",
  syncing: "Saving to account...",
  synced: "Account autosave on",
  "offline-pending": "Offline, will autosave when back online",
  error: "Account save issue"
};

const utilityNav: Array<{
  id: string;
  key: AppScreen;
  label: string;
  icon: ReactNode;
}> = [
  {
    id: "library",
    key: "library",
    label: "Word Library",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4.5h10.5A2.5 2.5 0 0 1 19 7v11.5a1 1 0 0 1-1.6.8l-1.9-1.4-1.9 1.4a1 1 0 0 1-1.2 0l-1.9-1.4-1.9 1.4a1 1 0 0 1-1.6-.8V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      </svg>
    )
  },
  {
    id: "statistics",
    key: "statistics",
    label: "Statistics",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19.5h16M7 17V10m5 7V6m5 11v-4" />
      </svg>
    )
  },
  {
    id: "achievements",
    key: "achievements",
    label: "Achievements",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4.5 14.2 9l4.9.7-3.6 3.5.9 4.8L12 15.9 7.6 18l.9-4.8-3.6-3.5L9.8 9 12 4.5Z" />
      </svg>
    )
  },
  {
    id: "settings",
    key: "settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm8 3.6-1.9-.7a6.6 6.6 0 0 0-.5-1.2l.9-1.8-1.8-1.8-1.8.9a6.6 6.6 0 0 0-1.2-.5L13 4h-2l-.7 1.9a6.6 6.6 0 0 0-1.2.5l-1.8-.9-1.8 1.8.9 1.8a6.6 6.6 0 0 0-.5 1.2L4 12v2l1.9.7c.1.4.3.8.5 1.2l-.9 1.8 1.8 1.8 1.8-.9c.4.2.8.4 1.2.5L11 20h2l.7-1.9c.4-.1.8-.3 1.2-.5l1.8.9 1.8-1.8-.9-1.8c.2-.4.4-.8.5-1.2L20 14v-2Z" />
      </svg>
    )
  }
];

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
  const classroomLabel =
    userRole === UserRole.STUDENT
      ? "Student Dashboard"
      : userRole === UserRole.TEACHER
        ? "Teacher Dashboard"
        : userRole === UserRole.ADMIN
          ? "Admin Dashboard"
          : "Classroom Dashboard";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-tag">SAT Prep</p>
          <h1>SAT Vocabulary Online</h1>
          <p className="brand-sub">Build SAT-ready vocabulary through focused practice, review, and measurable progress.</p>
        </div>

        <div className="mode-switcher">
          <span className="mode-pill active">Personal Dashboard</span>
          <Link href={mode === "guest" ? "/" : classroomHome} className="mode-pill">
            {classroomLabel}
          </Link>
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

        <nav className="sidebar-utility-grid" aria-label="Utility navigation">
          {utilityNav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`utility-icon ${screen === item.key ? "active" : ""}`}
              onClick={() => onNavigate(item.key)}
              aria-label={item.label}
              data-tooltip={item.label}
            >
              {item.icon}
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
