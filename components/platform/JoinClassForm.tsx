"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinClassForm() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!joinCode.trim()) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/classes/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode })
      });
      const payload = (await response.json()) as { error?: string; classroom?: { name: string } };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not join class.");
      }

      setMessage(`Joined ${payload.classroom?.name ?? "class"} successfully.`);
      setJoinCode("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h3>Join a class</h3>
      <p>Enter the teacher’s join code. Approval is not required.</p>
      <label className="field">
        <span>Class code</span>
        <input
          value={joinCode}
          onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
          placeholder="e.g. A7K9Q2"
          autoComplete="off"
        />
      </label>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Joining..." : "Join Class"}
      </button>
      {message ? <p className="success-copy">{message}</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}
    </form>
  );
}
