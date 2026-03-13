"use client";

import type { StorageMode, SyncStatus } from "@/lib/types";

const syncLabel: Record<SyncStatus, string> = {
  "guest-local": "Local only",
  syncing: "Syncing...",
  synced: "Synced",
  "offline-pending": "Offline (pending sync)",
  error: "Sync error"
};

export function ModeBadge({
  mode,
  syncStatus
}: {
  mode: StorageMode;
  syncStatus: SyncStatus;
}) {
  return (
    <div className="modeBadge">
      <span className={`modePill ${mode === "guest" ? "guest" : "account"}`}>
        {mode === "guest" ? "Guest Mode" : "Signed-In Mode"}
      </span>
      <span className="syncPill">{syncLabel[syncStatus]}</span>
    </div>
  );
}
