"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
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
  setAccountCacheSnapshot,
  setGuestSnapshot,
  setPendingSyncSnapshot
} from "@/utils/storage";

function guestMigrationMarkerKey(userId: string): string {
  return `sat_vocab_guest_migrated_${userId}`;
}

type MutableSnapshot = (snapshot: ProgressSnapshot) => ProgressSnapshot;

export function useStudyData() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const mode: StorageMode = userId ? "account" : "guest";
  const [snapshot, setSnapshot] = useState<ProgressSnapshot>(createEmptySnapshot());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("guest-local");
  const [ready, setReady] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncSnapshot = useCallback(
    async (nextSnapshot: ProgressSnapshot): Promise<void> => {
      if (!userId) return;
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
    [userId]
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
      if (!userId) {
        setGuestSnapshot(nextSnapshot);
        setSyncStatus("guest-local");
        return;
      }

      setAccountCacheSnapshot(nextSnapshot);
      debouncedSync(nextSnapshot);
    },
    [debouncedSync, userId]
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

  const refreshFromServer = useCallback(async (): Promise<ProgressSnapshot | null> => {
    if (!userId) return null;
    if (!navigator.onLine) {
      setSyncStatus("offline-pending");
      return null;
    }
    setSyncStatus("syncing");
    const response = await fetch("/api/progress", { cache: "no-store" });
    if (!response.ok) {
      setSyncStatus("error");
      return null;
    }
    const payload = (await response.json()) as { snapshot: ProgressSnapshot };
    const normalized = normalizeSnapshot(payload.snapshot);
    setSnapshot(normalized);
    setAccountCacheSnapshot(normalized);
    setSyncStatus("synced");
    return normalized;
  }, [userId]);

  useEffect(() => {
    const onOnline = () => {
      if (!userId) return;
      const pending = getPendingSyncSnapshot();
      if (pending) {
        void syncSnapshot(pending);
      } else {
        setSyncStatus("synced");
      }
    };

    const onOffline = () => {
      if (userId) setSyncStatus("offline-pending");
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [syncSnapshot, userId]);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      setReady(false);

      if (!userId) {
        setSnapshot(getGuestSnapshot());
        setSyncStatus("guest-local");
        setReady(true);
        return;
      }

      const cached = getAccountCacheSnapshot();
      setSnapshot(cached);
      setSyncStatus(navigator.onLine ? "syncing" : "offline-pending");

      if (!navigator.onLine) {
        setReady(true);
        return;
      }

      try {
        const guestSnapshot = getGuestSnapshot();
        const markerKey = guestMigrationMarkerKey(userId);
        const migrated = localStorage.getItem(markerKey) === "1";

        if (!migrated && hasMeaningfulData(guestSnapshot)) {
          const accountSnapshot = await refreshFromServer();
          const accountHasData = hasMeaningfulData(accountSnapshot ?? createEmptySnapshot());
          const strategy = accountHasData ? "merge" : "replace_account";

          const mergeResponse = await fetch("/api/progress/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              strategy,
              localSnapshot: guestSnapshot
            })
          });
          if (!mergeResponse.ok) throw new Error("Automatic guest migration failed");

          const mergedPayload = (await mergeResponse.json()) as {
            snapshot: ProgressSnapshot;
          };
          const normalized = normalizeSnapshot(mergedPayload.snapshot);
          if (!cancelled) {
            setSnapshot(normalized);
            setAccountCacheSnapshot(normalized);
            setSyncStatus("synced");
          }
          localStorage.setItem(markerKey, "1");
          clearGuestSnapshot();
        } else {
          await refreshFromServer();
        }
      } catch {
        if (!cancelled) {
          setSyncStatus(navigator.onLine ? "error" : "offline-pending");
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [refreshFromServer, userId]);

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

  const mergeLocalAndCurrent = useCallback(() => {
    const localSnapshot = userId ? getAccountCacheSnapshot() : getGuestSnapshot();
    const merged = mergeSnapshots(snapshot, localSnapshot);
    replaceSnapshot(merged);
  }, [replaceSnapshot, snapshot, userId]);

  const state = useMemo(
    () => ({
      mode,
      snapshot,
      replaceSnapshot,
      upsertWordProgress,
      toggleBookmark,
      addSession,
      syncStatus,
      ready,
      refreshFromServer,
      mergeLocalAndCurrent,
      isSignedIn: Boolean(userId),
      user: session?.user
    }),
    [
      addSession,
      mergeLocalAndCurrent,
      mode,
      ready,
      refreshFromServer,
      replaceSnapshot,
      session?.user,
      snapshot,
      syncStatus,
      toggleBookmark,
      upsertWordProgress,
      userId
    ]
  );

  return state;
}
