import { AppSettings, VocabLoadWarning } from "../types";
import type { StorageMode, SyncStatus } from "@/lib/types";

interface SettingsPageProps {
  settings: AppSettings;
  warnings: VocabLoadWarning[];
  mode: StorageMode;
  saveStatus: SyncStatus;
  isSignedIn: boolean;
  userEmail?: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdate: (patch: Partial<AppSettings>) => void;
  onResetProgress: () => Promise<void>;
}

const saveLabel: Record<SyncStatus, string> = {
  "guest-local": "Saved on this device",
  syncing: "Saving to account...",
  synced: "Account autosave on",
  "offline-pending": "Offline, will autosave when back online",
  error: "Account save issue"
};

export const SettingsPage = ({
  settings,
  warnings,
  mode,
  saveStatus,
  isSignedIn,
  userEmail,
  onSignIn,
  onSignOut,
  onUpdate,
  onResetProgress
}: SettingsPageProps) => {
  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Settings</h2>
          <p>Adjust timing, study defaults, and account preferences.</p>
        </div>
      </header>

      <div className="settings-grid">
        <article className="panel">
          <h3>Account Mode</h3>
          <p>
            Current mode: <strong>{mode === "guest" ? "Guest" : "Signed-in"}</strong>
          </p>
          <p>
            Save behavior: <strong>{saveLabel[saveStatus]}</strong>
          </p>
          {userEmail ? (
            <p>
              Signed in as <strong>{userEmail}</strong>
            </p>
          ) : (
            <p className="small-note">No active Google session.</p>
          )}
          <p className="small-note">
            Guest mode keeps progress only on this browser. Signed-in mode automatically saves
            progress to your account.
          </p>

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
          <h3>Reset Current Mode Progress</h3>
          <p>
            This clears all tracked study data for your current mode.
          </p>
          <button className="btn danger" onClick={() => void onResetProgress()}>
            Reset All Study Data
          </button>
        </article>
      </div>
    </section>
  );
};
