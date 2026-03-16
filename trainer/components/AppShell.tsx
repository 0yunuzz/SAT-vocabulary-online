import { ReactNode } from "react";
import { AppScreen } from "../types";
import type { StorageMode, SyncStatus } from "@/lib/types";

interface AppShellProps {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  mode: StorageMode;
  saveStatus: SyncStatus;
  userEmail?: string | null;
  children: ReactNode;
}

const navItems: Array<{ key: AppScreen; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "statistics", label: "Statistics" },
  { key: "setup", label: "Practice" },
  { key: "review", label: "Review" },
  { key: "library", label: "Word Library" },
  { key: "achievements", label: "Achievements" },
  { key: "settings", label: "Settings" },
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
  children
}: AppShellProps) => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-tag">SAT Prep</p>
          <h1>Vocabulary Studio Online</h1>
          <p className="brand-sub">Adaptive practice with local guest mode and account autosave.</p>
        </div>

        <nav className="main-nav" aria-label="Primary">
          {navItems.map((item) => (
            <button
              key={item.key}
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
