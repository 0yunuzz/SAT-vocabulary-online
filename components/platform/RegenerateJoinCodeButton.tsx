"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RegenerateJoinCodeButtonProps {
  classId: string;
}

export function RegenerateJoinCodeButton({ classId }: RegenerateJoinCodeButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    if (busy) return;
    const confirmed = window.confirm(
      "Generate a new join code? Students can continue in class; old code will stop working."
    );
    if (!confirmed) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${classId}/join-code`, {
        method: "POST"
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not regenerate code.");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not regenerate code.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn ghost" type="button" onClick={() => void regenerate()} disabled={busy}>
      {busy ? "Updating..." : "Regenerate Join Code"}
    </button>
  );
}
