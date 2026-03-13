"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  type MergeStrategy,
  type ProgressSnapshot,
  type SessionRecord,
  type StorageMode,
  type SyncStatus,
  type WordProgress
} from "@/lib/types";
import {
  createEmptySnapshot,
  hasMeaningfulData,
  mergeSnapshots,
  normalizeSnapshot
} from "@/lib/snapshot";
import {
  clearGuestSnapshot,
  clearPendingSyncSnapshot,
  getAccountCacheSnapshot,
  getGuestSnapshot,
  getPendingSyncSnapshot,
  getStorageMode,
  setAccountCacheSnapshot,
  setGuestSnapshot,
  setPendingSyncSnapshot,
  setStorageMode
} from "@/utils/storage";

function guestMergeMarkerKey(userId: string): string {
  return `sat_vocab_guest_merged_${userId}`;
}

type MutableSnapshot = (snapshot: ProgressSnapshot) => ProgressSnapshot;

export function useStudyData() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [mode, setModeState] = useState<StorageMode>("guest");
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(createEmptySnapshot());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest-local");
  const [ready, setReady] = useState(false);
  const [mergeAvailable, setMergeAvailable] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSnapshot = useCallback(
    async (nextSnapshot: ProgressSnapshot): Promise<void> => {
      if (mode !== "account" || !userId) return;
      setAccountCacheSnapshot(nextSnapshot);

      if (!navigator.onLine) {
        setPendingSyncSnapshot(nextSnapshot);
        setSyncStatus("offline-pending");
        return;
      }

      try {
        setSyncStatus("syncing");
        const response = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshot: nextSnapshot })
        });
        if (!response.ok) throw new Error("Sync failed");
        const payload = (await response.json()) as { snapshot: ProgressSnapshot };
        const normalized = normalizeSnapshot(payload.snapshot);
        setAccountCacheSnapshot(normalized);
        clearPendingSyncSnapshot();
        setSyncStatus("synced");
      } catch {
        setPendingSyncSnapshot(nextSnapshot);
        setSyncStatus(navigator.onLine ? "error" : "offline-pending");
      }
    },
    [mode, userId]
  );

  const debouncedSync = useCallback(
    (nextSnapshot: ProgressSnapshot) => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void syncSnapshot(nextSnapshot);
      }, 700);
    },
    [syncSnapshot]
  );

  const persistSnapshot = useCallback(
    (nextSnapshot: ProgressSnapshot) => {
      if (mode === "guest") {
        setGuestSnapshot(nextSnapshot);
        setSyncStatus("guest-local");
        return;
      }

      setAccountCacheSnapshot(nextSnapshot);
      debouncedSync(nextSnapshot);
    },
    [debouncedSync, mode]
  );

  const commitSnapshot = useCallback(
    (mutate: MutableSnapshot) => {
      setSnapshot((previous) => {
        const updated = normalizeSnapshot(
          mutate({
            ...previous,
            updatedAt: new Date().toISOString()
          })
        );
        updated.updatedAt = new Date().toISOString();
        persistSnapshot(updated);
        return updated;
      });
    },
    [persistSnapshot]
  );

  const refreshFromServer = useCallback(async () => {
    if (mode !== "account" || !userId) return;
    if (!navigator.onLine) {
      setSyncStatus("offline-pending");
      return;
    }
    setSyncStatus("syncing");
    const response = await fetch("/api/progress", { cache: "no-store" });
    if (!response.ok) {
      setSyncStatus("error");
      return;
    }
    const payload = (await response.json()) as { snapshot: ProgressSnapshot };
    const normalized = normalizeSnapshot(payload.snapshot);
    setSnapshot(normalized);
    setAccountCacheSnapshot(normalized);
    setSyncStatus("synced");
  }, [mode, userId]);

  useEffect(() => {
    setModeState(getStorageMode());
  }, []);

  useEffect(() => {
    const onOnline = () => {
      if (mode !== "account") return;
      const pending = getPendingSyncSnapshot();
      if (pending) {
        void syncSnapshot(pending);
      } else {
        setSyncStatus("synced");
      }
    };

    const onOffline = () => {
      if (mode === "account") setSyncStatus("offline-pending");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [mode, syncSnapshot]);

  useEffect(() => {
    if (mode === "guest") {
      setSnapshot(getGuestSnapshot());
      setSyncStatus("guest-local");
      setReady(true);
      return;
    }

    const cached = getAccountCacheSnapshot();
    setSnapshot(cached);
    setReady(true);

    if (!userId) {
      setSyncStatus("error");
      return;
    }

    void refreshFromServer();
  }, [mode, refreshFromServer, userId]);

  useEffect(() => {
    if (!userId) {
      setMergeAvailable(false);
      return;
    }
    const mergedKey = guestMergeMarkerKey(userId);
    const alreadyMerged = localStorage.getItem(mergedKey) === "1";
    const guestSnapshot = getGuestSnapshot();
    setMergeAvailable(!alreadyMerged && hasMeaningfulData(guestSnapshot));
  }, [userId, snapshot.updatedAt]);

  const setMode = useCallback(
    (nextMode: StorageMode) => {
      setStorageMode(nextMode);
      setModeState(nextMode);
    },
    [setModeState]
  );

  const upsertWordProgress = useCallback(
    (wordProgress: WordProgress) => {
      commitSnapshot((current) => {
        const recentWords = [
          wordProgress.word,
          ...current.recentWords.filter((entry) => entry !== wordProgress.word)
        ].slice(0, 50);

        return {
          ...current,
          wordProgress: {
            ...current.wordProgress,
            [wordProgress.word]: wordProgress
          },
          recentWords
        };
      });
    },
    [commitSnapshot]
  );

  const toggleBookmark = useCallback(
    (word: string) => {
      commitSnapshot((current) => {
        const exists = current.bookmarks.includes(word);
        return {
          ...current,
          bookmarks: exists
            ? current.bookmarks.filter((entry) => entry !== word)
            : [...current.bookmarks, word]
        };
      });
    },
    [commitSnapshot]
  );

  const addSession = useCallback(
    (sessionRecord: SessionRecord) => {
      commitSnapshot((current) => ({
        ...current,
        sessions: [sessionRecord, ...current.sessions].slice(0, 200)
      }));
    },
    [commitSnapshot]
  );

  const replaceSnapshot = useCallback(
    (nextSnapshot: ProgressSnapshot) => {
      const normalized = normalizeSnapshot(nextSnapshot);
      setSnapshot(normalized);
      persistSnapshot(normalized);
    },
    [persistSnapshot]
  );

  const mergeGuestIntoAccount = useCallback(
    async (strategy: MergeStrategy): Promise<{ success: boolean; message: string }> => {
      if (!userId) {
        return {
          success: false,
          message: "Sign in with Google first."
        };
      }

      const guestSnapshot = getGuestSnapshot();
      if (!hasMeaningfulData(guestSnapshot)) {
        return {
          success: true,
          message: "No guest data was found."
        };
      }

      const mergedKey = guestMergeMarkerKey(userId);

      if (strategy === "keep_account") {
        localStorage.setItem(mergedKey, "1");
        clearGuestSnapshot();
        setMergeAvailable(false);
        return {
          success: true,
          message: "Kept account progress."
        };
      }

      try {
        const response = await fetch("/api/progress/merge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy,
            localSnapshot: guestSnapshot
          })
        });
        if (!response.ok) throw new Error("Merge failed");
        const payload = (await response.json()) as { snapshot: ProgressSnapshot };
        const normalized = normalizeSnapshot(payload.snapshot);
        setSnapshot(normalized);
        setAccountCacheSnapshot(normalized);
        localStorage.setItem(mergedKey, "1");
        clearGuestSnapshot();
        setMergeAvailable(false);
        setSyncStatus("synced");
        return {
          success: true,
          message:
            strategy === "merge"
              ? "Guest and account progress merged."
              : "Account progress replaced with guest progress."
        };
      } catch {
        return {
          success: false,
          message: "Merge failed. Try again when online."
        };
      }
    },
    [userId]
  );

  const mergeLocalAndCurrent = useCallback(() => {
    const localSnapshot = mode === "guest" ? getGuestSnapshot() : getAccountCacheSnapshot();
    const merged = mergeSnapshots(snapshot, localSnapshot);
    replaceSnapshot(merged);
  }, [mode, replaceSnapshot, snapshot]);

  const state = useMemo(
    () => ({
      mode,
      setMode,
      snapshot,
      replaceSnapshot,
      upsertWordProgress,
      toggleBookmark,
      addSession,
      syncStatus,
      ready,
      mergeAvailable,
      mergeGuestIntoAccount,
      refreshFromServer,
      mergeLocalAndCurrent,
      isSignedIn: Boolean(userId),
      user: session?.user
    }),
    [
      addSession,
      mergeAvailable,
      mergeGuestIntoAccount,
      mergeLocalAndCurrent,
      mode,
      ready,
      refreshFromServer,
      replaceSnapshot,
      session?.user,
      setMode,
      snapshot,
      syncStatus,
      toggleBookmark,
      upsertWordProgress,
      userId
    ]
  );

  return state;
}
