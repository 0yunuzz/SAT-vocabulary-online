"use client";

import { useState } from "react";
import type { MergeStrategy } from "@/lib/types";

interface GuestMergeCardProps {
  onMerge: (strategy: MergeStrategy) => Promise<{ success: boolean; message: string }>;
}

export function GuestMergeCard({ onMerge }: GuestMergeCardProps) {
  const [busy, setBusy] = useState<MergeStrategy | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = async (strategy: MergeStrategy) => {
    setBusy(strategy);
    const result = await onMerge(strategy);
    setMessage(result.message);
    setBusy(null);
  };

  return (
    <section className="panel">
      <h3>Guest Progress Detected</h3>
      <p>
        We found local guest progress on this device. Choose how to handle it for
        your signed-in account.
      </p>
      <div className="buttonRow">
        <button
          type="button"
          className="button secondary"
          disabled={busy !== null}
          onClick={() => void run("keep_account")}
        >
          Keep account progress
        </button>
        <button
          type="button"
          className="button secondary"
          disabled={busy !== null}
          onClick={() => void run("replace_account")}
        >
          Replace with guest progress
        </button>
        <button
          type="button"
          className="button"
          disabled={busy !== null}
          onClick={() => void run("merge")}
        >
          Merge both datasets
        </button>
      </div>
      {message ? <p className="statusText">{message}</p> : null}
    </section>
  );
}
