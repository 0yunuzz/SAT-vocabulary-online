"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { GuestMergeCard } from "@/components/guest-merge-card";
import { ModeBadge } from "@/components/mode-badge";
import { useStudyData } from "@/utils/use-study-data";

const featureBullets = [
  "Multiple-choice only practice",
  "Word -> Definition",
  "Definition -> Word",
  "Sentence context questions",
  "Mixed practice mode",
  "Weak words and missed words modes",
  "Bookmarks, recents, adaptive prioritization",
  "Retry once on incorrect answers",
  "Dashboard analytics, sessions, streaks, achievements"
];

export default function HomePage() {
  const router = useRouter();
  const {
    mode,
    setMode,
    syncStatus,
    isSignedIn,
    user,
    mergeAvailable,
    mergeGuestIntoAccount
  } = useStudyData();

  const signedInLabel = useMemo(() => {
    if (!isSignedIn) return "Not signed in";
    return user?.email ?? "Signed in";
  }, [isSignedIn, user?.email]);

  return (
    <>
      <section className="panel hero">
        <div>
          <span className="eyebrow">SAT Vocabulary Trainer</span>
          <h1>Train Anywhere With Guest Or Synced Account Mode</h1>
          <p>
            Choose local guest practice or Google sign-in for cloud sync across
            devices. Your existing study workflow is preserved with adaptive review
            and full analytics.
          </p>
        </div>
        <div className="buttonRow">
          <button
            className="button secondary"
            type="button"
            onClick={() => {
              setMode("guest");
              router.push("/study");
            }}
          >
            Continue as Guest
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              setMode("account");
              void signIn("google", { callbackUrl: "/study" });
            }}
          >
            Sign in with Google
          </button>
        </div>
      </section>

      <section className="panel splitColumns">
        <div>
          <h3>Current Mode</h3>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
          <p className="muted">{signedInLabel}</p>
        </div>
        <div>
          <h3>Included Study Features</h3>
          <ul>
            {featureBullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      {isSignedIn && mode === "account" && mergeAvailable ? (
        <GuestMergeCard onMerge={mergeGuestIntoAccount} />
      ) : null}
    </>
  );
}
