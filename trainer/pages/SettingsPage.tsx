import { AppSettings, VocabLoadWarning } from "../types";
import type { StorageMode, SyncStatus } from "@/lib/types";

interface SettingsPageProps {
  settings: AppSettings;
  warnings: VocabLoadWarning[];
  storageMode: StorageMode;
  syncStatus: SyncStatus;
  isSignedIn: boolean;
  userEmail?: string | null;
  mergeAvailable: boolean;
  onSetStorageMode: (mode: StorageMode) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  onMergeGuestProgress: () => Promise<{ success: boolean; message: string }>;
  onRefreshSync: () => void;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onResetProgress: () => Promise<void>;
}

const syncLabel: Record<SyncStatus, string> = {
  "guest-local": "Local only",
  syncing: "Syncing...",
  synced: "Synced",
  "offline-pending": "Offline (pending sync)",
  error: "Sync error"
};

export const SettingsPage = ({
  settings,
  warnings,
  storageMode,
  syncStatus,
  isSignedIn,
  userEmail,
  mergeAvailable,
  onSetStorageMode,
  onSignIn,
  onSignOut,
  onMergeGuestProgress,
  onRefreshSync,
  onUpdate,
  onResetProgress
}: SettingsPageProps) => {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Adjust timing, study defaults, storage mode, and account sync controls.</p>
        </div>
      </header>

      <div className="settings-grid">
        <article className="panel">
          <h3>Storage & Account</h3>
          <p>
            Current mode: <strong>{storageMode === "guest" ? "Guest" : "Signed-in"}</strong>
          </p>
          <p>
            Sync status: <strong>{syncLabel[syncStatus]}</strong>
          </p>
          {userEmail ? (
            <p>
              Signed in as <strong>{userEmail}</strong>
            </p>
          ) : (
            <p className="small-note">No active Google session.</p>
          )}

          <div className="buttonRow">
            <button
              type="button"
              className={`btn ${storageMode === "guest" ? "secondary" : "ghost"}`}
              onClick={() => onSetStorageMode("guest")}
            >
              Use Guest Mode
            </button>
            <button
              type="button"
              className={`btn ${storageMode === "account" ? "secondary" : "ghost"}`}
              onClick={() => onSetStorageMode("account")}
            >
              Use Signed-In Mode
            </button>
            <button type="button" className="btn ghost" onClick={onRefreshSync}>
              Refresh Sync
            </button>
          </div>

          <div className="buttonRow">
            {isSignedIn ? (
              <button type="button" className="btn ghost" onClick={onSignOut}>
                Sign out
              </button>
            ) : (
              <button type="button" className="btn primary" onClick={onSignIn}>
                Sign in with Google
              </button>
            )}
            {isSignedIn && storageMode === "account" && mergeAvailable ? (
              <button
                type="button"
                className="btn secondary"
                onClick={() => void onMergeGuestProgress()}
              >
                Merge Guest Progress
              </button>
            ) : null}
          </div>
        </article>

        <article className="panel form-panel">
          <div className="field-row">
            <div className="field">
              <label htmlFor="defaultCount">Default session size</label>
              <input
                id="defaultCount"
                type="number"
                min={5}
                max={200}
                value={settings.defaultQuestionCount}
                onChange={(event) => onUpdate({ defaultQuestionCount: Number(event.target.value) })}
              />
            </div>

            <div className="field">
              <label htmlFor="defaultTimer">Default timer mode</label>
              <select
                id="defaultTimer"
                value={settings.timerMode}
                onChange={(event) => onUpdate({ timerMode: event.target.value as AppSettings["timerMode"] })}
              >
                <option value="untimed">Untimed</option>
                <option value="question">Per question</option>
                <option value="session">Session timer</option>
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="questionSec">Default question timer (sec)</label>
              <input
                id="questionSec"
                type="number"
                min={5}
                max={120}
                value={settings.questionTimeLimitSec}
                onChange={(event) => onUpdate({ questionTimeLimitSec: Number(event.target.value) })}
              />
            </div>

            <div className="field">
              <label htmlFor="sessionSec">Default session timer (sec)</label>
              <input
                id="sessionSec"
                type="number"
                min={60}
                max={3600}
                value={settings.sessionTimeLimitSec}
                onChange={(event) => onUpdate({ sessionTimeLimitSec: Number(event.target.value) })}
              />
            </div>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.autoAdvanceOnCorrect}
              onChange={(event) => onUpdate({ autoAdvanceOnCorrect: event.target.checked })}
            />
            Auto-advance after correct answer
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.darkMode}
              onChange={(event) => onUpdate({ darkMode: event.target.checked })}
            />
            Dark mode
          </label>
        </article>

        <article className="panel">
          <h3>Data Input Warnings</h3>
          {warnings.length ? (
            <ul className="warning-list">
              {warnings.slice(0, 25).map((warning, index) => (
                <li key={`${warning.message}-${index}`}>
                  <strong>{warning.row > 0 ? `Row ${warning.row}` : "Notice"}:</strong> {warning.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No parser warnings detected in your vocabulary file.</p>
          )}
        </article>

        <article className="panel danger-zone">
          <h3>Reset Local Progress</h3>
          <p>
            This clears all tracked study data for the current mode and sync state.
          </p>
          <button className="btn danger" onClick={() => void onResetProgress()}>
            Reset All Study Data
          </button>
        </article>
      </div>
    </section>
  );
};
