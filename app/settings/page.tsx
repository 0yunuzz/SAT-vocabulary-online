"use client";

import { signIn, signOut } from "next-auth/react";
import { GuestMergeCard } from "@/components/guest-merge-card";
import { ModeBadge } from "@/components/mode-badge";
import { useStudyData } from "@/utils/use-study-data";

export default function SettingsPage() {
  const {
    mode,
    setMode,
    syncStatus,
    mergeAvailable,
    mergeGuestIntoAccount,
    refreshFromServer,
    isSignedIn,
    user
  } = useStudyData();

  return (
    <>
      <section className="panel">
        <h2>Settings</h2>
        <p className="muted">Manage storage mode, sync state, and account details.</p>
      </section>

      <section className="panel splitColumns">
        <div>
          <h3>Storage Mode</h3>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
          <p className="muted">
            Guest mode stores progress on this device only. Signed-in mode syncs to
            Vercel Postgres.
          </p>
          <div className="buttonRow">
            <button
              type="button"
              className={`button ${mode === "guest" ? "secondary" : ""}`}
              onClick={() => setMode("guest")}
            >
              Use Guest Mode
            </button>
            <button
              type="button"
              className={`button ${mode === "account" ? "secondary" : ""}`}
              onClick={() => setMode("account")}
            >
              Use Signed-In Mode
            </button>
            {mode === "account" ? (
              <button type="button" className="button ghost" onClick={() => void refreshFromServer()}>
                Refresh Sync
              </button>
            ) : null}
          </div>
        </div>
        <div>
          <h3>Account</h3>
          {isSignedIn ? (
            <>
              <p>
                <strong>Name:</strong> {user?.name ?? "No name"}
              </p>
              <p>
                <strong>Email:</strong> {user?.email ?? "No email"}
              </p>
              <button
                type="button"
                className="button ghost"
                onClick={() => void signOut({ callbackUrl: "/" })}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="muted">No active Google session.</p>
              <button
                type="button"
                className="button"
                onClick={() => void signIn("google", { callbackUrl: "/settings" })}
              >
                Sign in with Google
              </button>
            </>
          )}
        </div>
      </section>

      {isSignedIn && mode === "account" && mergeAvailable ? (
        <GuestMergeCard onMerge={mergeGuestIntoAccount} />
      ) : null}
    </>
  );
}
