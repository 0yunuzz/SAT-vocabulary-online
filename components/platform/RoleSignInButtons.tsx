"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

interface RoleSignInButtonsProps {
  compact?: boolean;
}

export function RoleSignInButtons({ compact = false }: RoleSignInButtonsProps) {
  const [busyRole, setBusyRole] = useState<"student" | "teacher" | null>(null);

  const startSignIn = async (role: "student" | "teacher") => {
    setBusyRole(role);
    await signIn("google", { callbackUrl: `/welcome?intent=${role}` });
  };

  return (
    <div className={`role-signin ${compact ? "compact" : ""}`}>
      <button
        className="btn primary"
        type="button"
        disabled={busyRole !== null}
        onClick={() => void startSignIn("student")}
      >
        {busyRole === "student" ? "Connecting..." : "Create Student Account"}
      </button>
      <button
        className="btn secondary"
        type="button"
        disabled={busyRole !== null}
        onClick={() => void startSignIn("teacher")}
      >
        {busyRole === "teacher" ? "Connecting..." : "Create Teacher Account"}
      </button>
    </div>
  );
}
