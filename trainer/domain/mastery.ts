import { MAX_EVENT_HISTORY_PER_WORD } from "./constants";
import { AttemptOutcome, PracticeMode, QuestionType, WordEvent, WordProgress } from "../types";
import { clamp } from "../utils/text";

const firstTryDelta = 8;
const secondTryDelta = 3;
const missedDelta = -10;
const skippedDelta = -4;

const intervalByMastery = (score: number): number => {
  if (score >= 92) return 21;
  if (score >= 82) return 14;
  if (score >= 68) return 7;
  if (score >= 52) return 4;
  if (score >= 38) return 2;
  return 1;
};

const nextDueForOutcome = (score: number, outcome: AttemptOutcome): string => {
  const now = Date.now();
  const day = 86400000;

  if (outcome === "missed") {
    return new Date(now + day / 4).toISOString();
  }

  if (outcome === "skipped") {
    return new Date(now + day / 6).toISOString();
  }

  if (outcome === "second_try") {
    return new Date(now + day / 2).toISOString();
  }

  return new Date(now + intervalByMastery(score) * day).toISOString();
};

export const createEmptyWordProgress = (wordId: string): WordProgress => ({
  wordId,
  timesSeen: 0,
  firstTryCorrect: 0,
  secondTryCorrect: 0,
  missed: 0,
  skipped: 0,
  totalResponseMs: 0,
  recentEvents: [],
  masteryScore: 28,
  successfulRecallStreak: 0,
  secondTryReliance: 0,
  lastSeenAt: undefined,
  nextDueAt: undefined,
});

export const applyWordOutcome = (
  existing: WordProgress | undefined,
  wordId: string,
  outcome: AttemptOutcome,
  responseMs: number,
  mode: PracticeMode,
  questionType: QuestionType,
  atIso: string
): WordProgress => {
  const progress = existing ? { ...existing } : createEmptyWordProgress(wordId);

  progress.timesSeen += 1;
  progress.totalResponseMs += responseMs;
  progress.lastSeenAt = atIso;

  if (outcome === "first_try") {
    progress.firstTryCorrect += 1;
    progress.successfulRecallStreak += 1;
    progress.masteryScore = clamp(progress.masteryScore + firstTryDelta, 0, 100);
  } else if (outcome === "second_try") {
    progress.secondTryCorrect += 1;
    progress.secondTryReliance += 1;
    progress.successfulRecallStreak = Math.max(0, progress.successfulRecallStreak - 1);
    progress.masteryScore = clamp(progress.masteryScore + secondTryDelta, 0, 100);
  } else if (outcome === "missed") {
    progress.missed += 1;
    progress.secondTryReliance += 1;
    progress.successfulRecallStreak = 0;
    progress.masteryScore = clamp(progress.masteryScore + missedDelta, 0, 100);
  } else {
    progress.skipped += 1;
    progress.successfulRecallStreak = 0;
    progress.masteryScore = clamp(progress.masteryScore + skippedDelta, 0, 100);
  }

  progress.nextDueAt = nextDueForOutcome(progress.masteryScore, outcome);

  const event: WordEvent = {
    at: atIso,
    mode,
    questionType,
    outcome,
    responseMs,
  };

  progress.recentEvents = [event, ...progress.recentEvents].slice(0, MAX_EVENT_HISTORY_PER_WORD);

  return progress;
};

export const getWordAccuracy = (progress: WordProgress | undefined): number => {
  if (!progress || !progress.timesSeen) {
    return 0;
  }

  return (progress.firstTryCorrect + progress.secondTryCorrect) / progress.timesSeen;
};

export const wordStatus = (
  progress: WordProgress | undefined
): "unseen" | "weak" | "learning" | "mastered" => {
  if (!progress || progress.timesSeen === 0) {
    return "unseen";
  }

  if (progress.masteryScore >= 80 && progress.firstTryCorrect >= 3) {
    return "mastered";
  }

  const missRate = progress.missed / Math.max(progress.timesSeen, 1);
  if (progress.masteryScore < 40 || missRate > 0.35) {
    return "weak";
  }

  return "learning";
};
