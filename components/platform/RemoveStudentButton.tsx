"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RemoveStudentButtonProps {
  classId: string;
  studentId: string;
}

export function RemoveStudentButton({ classId, studentId }: RemoveStudentButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const removeStudent = async () => {
    if (busy) return;
    const confirmed = window.confirm(
      "Remove this student from the class? Historical assignment records will remain."
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/classes/${classId}/students/${studentId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not remove student.");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not remove student.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn ghost" type="button" onClick={() => void removeStudent()} disabled={busy}>
      {busy ? "Removing..." : "Remove"}
    </button>
  );
}
