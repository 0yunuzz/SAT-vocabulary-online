import type {
  ProgressSnapshot,
  SessionRecord,
  StreakState,
  WordProgress
} from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function createEmptySnapshot(): ProgressSnapshot {
  return {
    wordProgress: {},
    bookmarks: [],
    recentWords: [],
    sessions: [],
    achievements: [],
    streak: {
      currentStreak: 0,
      longestStreak: 0
    },
    updatedAt: new Date().toISOString()
  };
}

export function hasMeaningfulData(snapshot: ProgressSnapshot): boolean {
  return (
    Object.keys(snapshot.wordProgress).length > 0 ||
    snapshot.bookmarks.length > 0 ||
    snapshot.sessions.length > 0 ||
    snapshot.achievements.length > 0
  );
}

export function normalizeSnapshot(
  snapshot: Partial<ProgressSnapshot> | null | undefined
): ProgressSnapshot {
  if (!snapshot) return createEmptySnapshot();

  return {
    wordProgress: snapshot.wordProgress ?? {},
    bookmarks: [...new Set(snapshot.bookmarks ?? [])],
    recentWords: [...new Set(snapshot.recentWords ?? [])].slice(0, 50),
    sessions: (snapshot.sessions ?? []).sort(
      (a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)
    ),
    achievements: [...new Set(snapshot.achievements ?? [])],
    streak: {
      currentStreak: snapshot.streak?.currentStreak ?? 0,
      longestStreak: snapshot.streak?.longestStreak ?? 0,
      lastStudyDate: snapshot.streak?.lastStudyDate
    },
    updatedAt: snapshot.updatedAt ?? new Date().toISOString()
  };
}

export function mergeProgressItems(
  accountItem: WordProgress | undefined,
  localItem: WordProgress | undefined
): WordProgress | undefined {
  if (!accountItem && !localItem) return undefined;
  if (!accountItem) return localItem;
  if (!localItem) return accountItem;

  const accountTime = accountItem.updatedAt
    ? +new Date(accountItem.updatedAt)
    : 0;
  const localTime = localItem.updatedAt ? +new Date(localItem.updatedAt) : 0;
  const newest = localTime >= accountTime ? localItem : accountItem;
  const oldest = newest === localItem ? accountItem : localItem;

  const attempts = Math.max(newest.attempts, oldest.attempts);
  const correct = Math.max(newest.correctAnswers, oldest.correctAnswers);
  const incorrect = Math.max(newest.incorrectAnswers, oldest.incorrectAnswers);

  return {
    ...newest,
    attempts,
    correctAnswers: correct,
    incorrectAnswers: incorrect,
    masteryScore: newest.masteryScore,
    updatedAt: new Date(Math.max(accountTime, localTime) || Date.now()).toISOString()
  };
}

export function mergeSnapshots(
  account: ProgressSnapshot,
  local: ProgressSnapshot
): ProgressSnapshot {
  const normalizedAccount = normalizeSnapshot(account);
  const normalizedLocal = normalizeSnapshot(local);

  const words = new Set([
    ...Object.keys(normalizedAccount.wordProgress),
    ...Object.keys(normalizedLocal.wordProgress)
  ]);
  const wordProgress: Record<string, WordProgress> = {};

  words.forEach((word) => {
    const merged = mergeProgressItems(
      normalizedAccount.wordProgress[word],
      normalizedLocal.wordProgress[word]
    );
    if (merged) wordProgress[word] = merged;
  });

  const bookmarks = [
    ...new Set([...normalizedAccount.bookmarks, ...normalizedLocal.bookmarks])
  ];
  const achievements = [
    ...new Set([
      ...normalizedAccount.achievements,
      ...normalizedLocal.achievements
    ])
  ];

  const sessionMap = new Map<string, SessionRecord>();
  [...normalizedAccount.sessions, ...normalizedLocal.sessions].forEach((session) => {
    const previous = sessionMap.get(session.id);
    if (!previous || +new Date(session.endedAt) > +new Date(previous.endedAt)) {
      sessionMap.set(session.id, session);
    }
  });
  const sessions = Array.from(sessionMap.values()).sort(
    (a, b) => +new Date(b.startedAt) - +new Date(a.startedAt)
  );

  const recentWords = [
    ...new Set([
      ...normalizedLocal.recentWords,
      ...normalizedAccount.recentWords
    ])
  ].slice(0, 50);

  const streak = mergeStreakStates(normalizedAccount.streak, normalizedLocal.streak);

  return {
    wordProgress,
    bookmarks,
    recentWords,
    sessions,
    achievements,
    streak,
    updatedAt: new Date().toISOString()
  };
}

function mergeStreakStates(account: StreakState, local: StreakState): StreakState {
  const accountDate = account.lastStudyDate ? +new Date(account.lastStudyDate) : 0;
  const localDate = local.lastStudyDate ? +new Date(local.lastStudyDate) : 0;
  const newest = localDate >= accountDate ? local : account;

  return {
    currentStreak: Math.max(account.currentStreak, local.currentStreak),
    longestStreak: Math.max(account.longestStreak, local.longestStreak),
    lastStudyDate: newest.lastStudyDate
  };
}

export function updateStreak(streak: StreakState, studyDate: Date): StreakState {
  const normalizedDate = new Date(studyDate);
  normalizedDate.setHours(0, 0, 0, 0);

  const lastDate = streak.lastStudyDate ? new Date(streak.lastStudyDate) : null;
  if (!lastDate) {
    return {
      currentStreak: 1,
      longestStreak: Math.max(1, streak.longestStreak),
      lastStudyDate: normalizedDate.toISOString()
    };
  }

  lastDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((+normalizedDate - +lastDate) / DAY_MS);
  if (diffDays === 0) return streak;

  const currentStreak = diffDays === 1 ? streak.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(streak.longestStreak, currentStreak),
    lastStudyDate: normalizedDate.toISOString()
  };
}
