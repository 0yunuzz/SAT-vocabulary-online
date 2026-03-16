export type StorageMode = "guest" | "account";

export type PracticeMode =
  | "word_to_definition"
  | "definition_to_word"
  | "sentence_context"
  | "mixed"
  | "weak_words"
  | "missed_words";

export type MergeStrategy = "keep_account" | "replace_account" | "merge";

export interface VocabWord {
  word: string;
  definition: string;
  exampleSentence: string;
}

export interface WordProgress {
  word: string;
  definition: string;
  exampleSentence: string;
  masteryScore: number;
  attempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  lastReviewed?: string;
  averageResponseMs: number;
  lastResponseMs?: number;
  needsRetry: boolean;
  isWeak: boolean;
  missedCount: number;
  lastResult?: "correct" | "incorrect";
  updatedAt?: string;
}

export interface SessionRecord {
  id: string;
  mode: PracticeMode;
  totalQuestions: number;
  correctAnswers: number;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  accuracy: number;
}

export interface StreakState {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: string;
}

export interface ProgressSnapshot {
  wordProgress: Record<string, WordProgress>;
  bookmarks: string[];
  recentWords: string[];
  sessions: SessionRecord[];
  achievements: string[];
  streak: StreakState;
  updatedAt: string;
}

export interface QuizQuestion {
  id: string;
  mode: Exclude<PracticeMode, "weak_words" | "missed_words" | "mixed">;
  sourceWord: VocabWord;
  prompt: string;
  choices: string[];
  correctChoice: string;
  helperText?: string;
}

export type SyncStatus =
  | "guest-local"
  | "syncing"
  | "synced"
  | "offline-pending"
  | "error";

export const GUEST_SNAPSHOT_KEY = "sat_vocab_guest_snapshot";
export const ACCOUNT_CACHE_KEY = "sat_vocab_account_cache";
export const PENDING_ACCOUNT_SYNC_KEY = "sat_vocab_pending_sync";
