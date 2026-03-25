"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

interface AssignmentSettingsFormProps {
  assignmentId: string;
  dueAtIso: string;
  instructions?: string | null;
  allowLateSubmissions: boolean;
}

function toLocalDateTimeInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AssignmentSettingsForm({
  assignmentId,
  dueAtIso,
  instructions,
  allowLateSubmissions
}: AssignmentSettingsFormProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState(toLocalDateTimeInput(dueAtIso));
  const [notes, setNotes] = useState(instructions ?? "");
  const [allowLate, setAllowLate] = useState(allowLateSubmissions);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueAt: new Date(dueAt).toISOString(),
          instructions: notes,
          allowLateSubmissions: allowLate
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update assignment.");
      }
      setMessage("Assignment settings updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update assignment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h3>Assignment settings</h3>
      <p>Editable fields only: due date, instructions, and late submission policy.</p>
      <label className="field">
        <span>Due date & time</span>
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Instructions</span>
        <textarea
          rows={4}
          className="input-textarea"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={allowLate}
          onChange={(event) => setAllowLate(event.target.checked)}
        />
        Allow late submissions
      </label>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Saving..." : "Save Settings"}
      </button>
      {message ? <p className="success-copy">{message}</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}
    </form>
  );
}
