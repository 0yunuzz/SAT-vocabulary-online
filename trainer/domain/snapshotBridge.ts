import type {
  PracticeMode as SyncPracticeMode,
  ProgressSnapshot as SyncSnapshot
} from "@/lib/types";
import type {
  AppData,
  AttemptOutcome,
  ModeStats,
  PracticeMode,
  SessionRecord,
  VocabWord,
  WordProgress
} from "../types";
import { createAchievementState, createEmptyAppData } from "./constants";
import { wordStatus } from "./mastery";
import { average } from "../utils/text";
import { todayKey } from "../utils/date";

const SYNC_MODES = new Set<SyncPracticeMode>([
  "word_to_definition",
  "definition_to_word",
  "sentence_context",
  "mixed",
  "weak_words",
  "missed_words"
]);

const emptyModeStats = (): ModeStats => ({
  answered: 0,
  firstTryCorrect: 0,
  secondTryCorrect: 0,
  missed: 0,
  skipped: 0,
  totalResponseMs: 0
});

const toSyncMode = (mode: PracticeMode): SyncPracticeMode =>
  SYNC_MODES.has(mode as SyncPracticeMode) ? (mode as SyncPracticeMode) : "mixed";

const asLocalMastery = (value: number): number =>
  value <= 1 ? Math.round(value * 100) : Math.round(value);

const asSyncMastery = (value: number): number =>
  value > 1 ? Number((value / 100).toFixed(4)) : Number(value.toFixed(4));

const updateDailyHistoryFromSession = (
  appData: AppData,
  session: SessionRecord
): void => {
  const dayKey = todayKey(new Date(session.endedAt));
  const entry = appData.dailyHistory[dayKey] ?? {
    date: dayKey,
    questions: 0,
    sessions: 0,
    firstTryCorrect: 0,
    secondTryCorrect: 0,
    missed: 0
  };

  entry.questions += session.questionCount;
  entry.sessions += 1;
  entry.firstTryCorrect += session.firstTryCorrect;
  entry.secondTryCorrect += session.secondTryCorrect;
  entry.missed += session.missed;
  appData.dailyHistory[dayKey] = entry;
};

export const fromSyncSnapshot = (
  snapshot: SyncSnapshot,
  words: VocabWord[]
): AppData => {
  const appData = createEmptyAppData();
  const wordsByText = new Map(words.map((word) => [word.word.toLowerCase(), word]));

  Object.values(snapshot.wordProgress).forEach((item) => {
    const word = wordsByText.get(item.word.toLowerCase());
    if (!word) return;

    const attempts = Math.max(0, item.attempts ?? 0);
    const correct = Math.max(0, item.correctAnswers ?? 0);
    const incorrect = Math.max(0, item.incorrectAnswers ?? 0);
    const avgMs = Math.max(0, Math.round(item.averageResponseMs ?? 0));

    const localProgress: WordProgress = {
      wordId: word.id,
      timesSeen: attempts,
      firstTryCorrect: correct,
      secondTryCorrect: 0,
      missed: incorrect,
      skipped: 0,
      totalResponseMs: attempts > 0 ? avgMs * attempts : 0,
      recentEvents: [],
      masteryScore: asLocalMastery(item.masteryScore ?? 0),
      successfulRecallStreak: 0,
      secondTryReliance: 0,
      lastSeenAt: item.lastReviewed,
      nextDueAt: undefined
    };

    appData.wordProgress[word.id] = localProgress;
  });

  appData.bookmarks = snapshot.bookmarks
    .map((word) => wordsByText.get(word.toLowerCase())?.id)
    .filter(Boolean) as string[];

  appData.recentWordIds = snapshot.recentWords
    .map((word) => wordsByText.get(word.toLowerCase())?.id)
    .filter(Boolean) as string[];

  appData.sessions = snapshot.sessions.map((session) => {
    const firstTryCorrect = Math.max(0, session.correctAnswers);
    const missed = Math.max(0, session.totalQuestions - firstTryCorrect);
    const averageResponseMs =
      session.totalQuestions > 0
        ? Math.round((session.durationSec * 1000) / session.totalQuestions)
        : 0;

    return {
      id: session.id,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      mode: session.mode as PracticeMode,
      timerMode: "untimed",
      questionCount: session.totalQuestions,
      firstTryCorrect,
      secondTryCorrect: 0,
      missed,
      skipped: 0,
      averageResponseMs,
      accuracy: session.accuracy,
      wordIds: [],
      difficultWordIds: [],
      strongestWordIds: [],
      results: []
    };
  });

  const stats = appData.stats;
  stats.totalSessions = appData.sessions.length;
  stats.totalQuestionsAnswered = appData.sessions.reduce(
    (sum, session) => sum + session.questionCount,
    0
  );
  stats.firstTryCorrect = appData.sessions.reduce(
    (sum, session) => sum + session.firstTryCorrect,
    0
  );
  stats.secondTryCorrect = appData.sessions.reduce(
    (sum, session) => sum + session.secondTryCorrect,
    0
  );
  stats.missed = appData.sessions.reduce((sum, session) => sum + session.missed, 0);
  stats.skipped = appData.sessions.reduce((sum, session) => sum + session.skipped, 0);
  stats.currentStreak = snapshot.streak.currentStreak ?? 0;
  stats.longestStreak = snapshot.streak.longestStreak ?? 0;
  stats.averageResponseMs = Math.round(
    average(appData.sessions.map((session) => session.averageResponseMs))
  );
  stats.lastPracticedAt = appData.sessions[appData.sessions.length - 1]?.endedAt;

  appData.sessions.forEach((session) => updateDailyHistoryFromSession(appData, session));

  const achievements = createAchievementState();
  const unlockedSet = new Set(snapshot.achievements);
  Object.values(achievements).forEach((achievement) => {
    if (unlockedSet.has(achievement.id)) {
      achievement.progress = achievement.target;
      achievement.unlockedAt = snapshot.updatedAt;
    }
  });
  appData.achievements = achievements;

  appData.lastUpdatedAt = snapshot.updatedAt;
  return appData;
};

const lastOutcome = (
  progress: WordProgress
): "correct" | "incorrect" | undefined => {
  const event = progress.recentEvents[0];
  if (!event) return undefined;
  if (event.outcome === "first_try" || event.outcome === "second_try") return "correct";
  return "incorrect";
};

export const toSyncSnapshot = (
  appData: AppData,
  wordsById: Map<string, VocabWord>
): SyncSnapshot => {
  const wordProgress: SyncSnapshot["wordProgress"] = {};

  Object.values(appData.wordProgress).forEach((progress) => {
    const word = wordsById.get(progress.wordId);
    if (!word) return;

    const attempts = Math.max(0, progress.timesSeen);
    const correctAnswers = Math.max(0, progress.firstTryCorrect + progress.secondTryCorrect);
    const incorrectAnswers = Math.max(0, progress.missed + progress.skipped);
    const averageResponseMs =
      attempts > 0 ? Math.round(progress.totalResponseMs / attempts) : 0;

    wordProgress[word.word] = {
      word: word.word,
      definition: word.definition,
      exampleSentence: word.exampleSentence,
      masteryScore: asSyncMastery(progress.masteryScore),
      attempts,
      correctAnswers,
      incorrectAnswers,
      lastReviewed: progress.lastSeenAt,
      averageResponseMs,
      lastResponseMs: progress.recentEvents[0]?.responseMs,
      needsRetry: lastOutcome(progress) === "incorrect",
      isWeak: wordStatus(progress) === "weak",
      missedCount: progress.missed,
      lastResult: lastOutcome(progress),
      updatedAt: appData.lastUpdatedAt
    };
  });

  const bookmarks = appData.bookmarks
    .map((wordId) => wordsById.get(wordId)?.word)
    .filter(Boolean) as string[];

  const recentWords = appData.recentWordIds
    .map((wordId) => wordsById.get(wordId)?.word)
    .filter(Boolean) as string[];

  const sessions = appData.sessions.map((session) => ({
    id: session.id,
    mode: toSyncMode(session.mode),
    totalQuestions: session.questionCount,
    correctAnswers: Math.max(0, session.firstTryCorrect + session.secondTryCorrect),
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSec: Math.max(
      1,
      Math.round((+new Date(session.endedAt) - +new Date(session.startedAt)) / 1000)
    ),
    accuracy: session.accuracy
  }));

  const unlockedAchievements = Object.values(appData.achievements)
    .filter((item) => item.unlockedAt || item.progress >= item.target)
    .map((item) => item.id);

  return {
    wordProgress,
    bookmarks,
    recentWords,
    sessions,
    achievements: unlockedAchievements,
    streak: {
      currentStreak: appData.stats.currentStreak,
      longestStreak: appData.stats.longestStreak,
      lastStudyDate: appData.stats.lastPracticedAt
    },
    updatedAt: appData.lastUpdatedAt
  };
};

export const isOutcomeCorrect = (outcome: AttemptOutcome): boolean =>
  outcome === "first_try" || outcome === "second_try";
