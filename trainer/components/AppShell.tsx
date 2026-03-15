import { ReactNode } from "react";
import { AppScreen } from "../types";
import type { StorageMode, SyncStatus } from "@/lib/types";

interface AppShellProps {
  screen: AppScreen;
  onNavigate: (screen: AppScreen) => void;
  storageMode: StorageMode;
  syncStatus: SyncStatus;
  userEmail?: string | null;
  children: ReactNode;
}

const navItems: Array<{ key: AppScreen; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "setup", label: "Practice" },
  { key: "review", label: "Review" },
  { key: "library", label: "Word Library" },
  { key: "achievements", label: "Achievements" },
  { key: "settings", label: "Settings" },
];

const syncLabel: Record<SyncStatus, string> = {
  "guest-local": "Local only",
  syncing: "Syncing...",
  synced: "Synced",
  "offline-pending": "Offline (pending sync)",
  error: "Sync error"
};

export const AppShell = ({
  screen,
  onNavigate,
  storageMode,
  syncStatus,
  userEmail,
  children
}: AppShellProps) => {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <p className="brand-tag">SAT Prep</p>
          <h1>Vocabulary Studio Online</h1>
          <p className="brand-sub">Adaptive online practice with guest and synced account modes.</p>
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
            {storageMode === "guest" ? "Guest mode" : "Signed-in mode"} | {syncLabel[syncStatus]}
          </p>
          {userEmail ? <p className="small-note">{userEmail}</p> : null}
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
};
