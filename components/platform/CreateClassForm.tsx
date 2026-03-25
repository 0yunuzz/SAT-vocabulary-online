"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not create class.");
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form-panel" onSubmit={onSubmit}>
      <h3>Create class</h3>
      <p>Create a class and share the generated join code with students.</p>
      <label className="field">
        <span>Class name</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="SAT Verbal - Period 1"
        />
      </label>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Creating..." : "Create Class"}
      </button>
      {error ? <p className="error-copy">{error}</p> : null}
    </form>
  );
}
