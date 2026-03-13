import {
  ACCOUNT_CACHE_KEY,
  GUEST_SNAPSHOT_KEY,
  PENDING_ACCOUNT_SYNC_KEY,
  STORAGE_MODE_KEY,
  type ProgressSnapshot,
  type StorageMode
} from "@/lib/types";
import { createEmptySnapshot, normalizeSnapshot } from "@/lib/snapshot";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getStorageMode(): StorageMode {
  const localStorage = getLocalStorage();
  if (!localStorage) return "guest";
  const stored = localStorage.getItem(STORAGE_MODE_KEY);
  return stored === "account" ? "account" : "guest";
}

export function setStorageMode(mode: StorageMode): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.setItem(STORAGE_MODE_KEY, mode);
}

export function getGuestSnapshot(): ProgressSnapshot {
  const localStorage = getLocalStorage();
  if (!localStorage) return createEmptySnapshot();
  const raw = localStorage.getItem(GUEST_SNAPSHOT_KEY);
  if (!raw) return createEmptySnapshot();
  try {
    return normalizeSnapshot(JSON.parse(raw) as ProgressSnapshot);
  } catch {
    return createEmptySnapshot();
  }
}

export function setGuestSnapshot(snapshot: ProgressSnapshot): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.setItem(GUEST_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getAccountCacheSnapshot(): ProgressSnapshot {
  const localStorage = getLocalStorage();
  if (!localStorage) return createEmptySnapshot();
  const raw = localStorage.getItem(ACCOUNT_CACHE_KEY);
  if (!raw) return createEmptySnapshot();
  try {
    return normalizeSnapshot(JSON.parse(raw) as ProgressSnapshot);
  } catch {
    return createEmptySnapshot();
  }
}

export function setAccountCacheSnapshot(snapshot: ProgressSnapshot): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.setItem(ACCOUNT_CACHE_KEY, JSON.stringify(snapshot));
}

export function setPendingSyncSnapshot(snapshot: ProgressSnapshot): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.setItem(PENDING_ACCOUNT_SYNC_KEY, JSON.stringify(snapshot));
}

export function getPendingSyncSnapshot(): ProgressSnapshot | null {
  const localStorage = getLocalStorage();
  if (!localStorage) return null;
  const raw = localStorage.getItem(PENDING_ACCOUNT_SYNC_KEY);
  if (!raw) return null;
  try {
    return normalizeSnapshot(JSON.parse(raw) as ProgressSnapshot);
  } catch {
    return null;
  }
}

export function clearPendingSyncSnapshot(): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.removeItem(PENDING_ACCOUNT_SYNC_KEY);
}

export function clearGuestSnapshot(): void {
  const localStorage = getLocalStorage();
  if (!localStorage) return;
  localStorage.removeItem(GUEST_SNAPSHOT_KEY);
}
