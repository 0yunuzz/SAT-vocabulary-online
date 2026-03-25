"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SelectableRole = "STUDENT" | "TEACHER";

interface RoleChooserProps {
  suggestedRole?: SelectableRole;
}

const roleRoute: Record<SelectableRole, string> = {
  STUDENT: "/student",
  TEACHER: "/teacher"
};

export function RoleChooser({ suggestedRole = "STUDENT" }: RoleChooserProps) {
  const router = useRouter();
  const [busyRole, setBusyRole] = useState<SelectableRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chooseRole = async (role: SelectableRole) => {
    setBusyRole(role);
    setError(null);

    try {
      const response = await fetch("/api/account/role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ role })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update role.");
      }
      router.push(roleRoute[role]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update role.");
      setBusyRole(null);
    }
  };

  return (
    <div className="panel role-chooser">
      <h3>Choose your account role</h3>
      <div className="role-choice-grid">
        <button
          type="button"
          className={`role-choice ${suggestedRole === "STUDENT" ? "suggested" : ""}`}
          onClick={() => void chooseRole("STUDENT")}
          disabled={busyRole !== null}
        >
          <strong>Student Account</strong>
          <span>Join classes, complete homework, and keep personal study progress.</span>
        </button>
        <button
          type="button"
          className={`role-choice ${suggestedRole === "TEACHER" ? "suggested" : ""}`}
          onClick={() => void chooseRole("TEACHER")}
          disabled={busyRole !== null}
        >
          <strong>Teacher Account</strong>
          <span>Create classes, assign homework, and track class performance.</span>
        </button>
      </div>
      {busyRole ? <p className="small-note">Saving role...</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}
    </div>
  );
}
