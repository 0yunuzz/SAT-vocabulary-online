"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RoleValue = "STUDENT" | "TEACHER" | "ADMIN";

interface AdminRoleSelectorProps {
  userId: string;
  email: string | null;
  role: RoleValue;
  locked: boolean;
}

export function AdminRoleSelector({
  userId,
  email,
  role,
  locked
}: AdminRoleSelectorProps) {
  const router = useRouter();
  const [value, setValue] = useState<RoleValue>(role);
  const [busy, setBusy] = useState(false);

  const updateRole = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: value })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not update role.");
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not update role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-role-editor">
      <select
        value={value}
        disabled={busy || locked}
        onChange={(event) => setValue(event.target.value as RoleValue)}
      >
        <option value="STUDENT">Student</option>
        <option value="TEACHER">Teacher</option>
        {locked ? <option value="ADMIN">Admin</option> : null}
      </select>
      <button
        className="btn ghost"
        type="button"
        disabled={busy || locked || value === role}
        onClick={() => void updateRole()}
      >
        {busy ? "Saving..." : "Update"}
      </button>
      {locked ? <span className="small-note">{email} is locked as admin.</span> : null}
    </div>
  );
}
