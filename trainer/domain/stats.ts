import { MAX_SESSIONS } from "./constants";
import { applyWordOutcome, createEmptyWordProgress, wordStatus } from "./mastery";
import {
  AchievementState,
  AppData,
  AttemptOutcome,
  PracticeMode,
  SessionQuestionResult,
  SessionRecord,
  SessionSummary,
  VocabWord,
} from "../types";
import { todayKey } from "../utils/date";
import { average, clamp } from "../utils/text";

interface SessionBuildInput {
  sessionId: string;
  mode: PracticeMode;
  timerMode: SessionRecord["timerMode"];
  startedAt: string;
  endedAt: string;
  results: SessionQuestionResult[];
}

const accuracyFromResults = (results: SessionQuestionResult[]): number => {
  if (!results.length) return 0;

  const correct = results.filter(
    (result) => result.outcome === "first_try" || result.outcome === "second_try"
  ).length;

  return correct / results.length;
};

const buildSessionRecord = ({
  sessionId,
  mode,
  timerMode,
  startedAt,
  endedAt,
  results,
}: SessionBuildInput): SessionRecord => {
  const firstTryCorrect = results.filter((result) => result.outcome === "first_try").length;
  const secondTryCorrect = results.filter((result) => result.outcome === "second_try").length;
  const missed = results.filter((result) => result.outcome === "missed").length;
  const skipped = results.filter((result) => result.outcome === "skipped").length;

  const difficultWordIds = results
    .filter((result) => result.outcome === "missed" || result.outcome === "second_try")
    .map((result) => result.wordId)
    .slice(0, 10);

  const strongestWordIds = results
    .filter((result) => result.outcome === "first_try")
    .sort((a, b) => a.responseMs - b.responseMs)
    .map((result) => result.wordId)
    .slice(0, 10);

  return {
    id: sessionId,
    startedAt,
    endedAt,
    mode,
    timerMode,
    questionCount: results.length,
    firstTryCorrect,
    secondTryCorrect,
    missed,
    skipped,
    averageResponseMs: average(results.map((result) => result.responseMs)),
    accuracy: accuracyFromResults(results),
    wordIds: results.map((result) => result.wordId),
    difficultWordIds,
    strongestWordIds,
    results,
  };
};

const updateAchievement = (
  achievement: AchievementState,
  value: number,
  nowIso: string
): AchievementState => {
  const progress = clamp(Math.max(achievement.progress, value), 0, achievement.target);
  return {
    ...achievement,
    progress,
    unlockedAt: progress >= achievement.target ? achievement.unlockedAt ?? nowIso : achievement.unlockedAt,
  };
};

const consecutiveStudyDays = (days: string[]): number => {
  if (!days.length) return 0;
  const sorted = [...new Set(days)].sort((a, b) => (a > b ? -1 : 1));
  let streak = 1;

  for (let i = 1; i < sorted.length; i += 1) {
    const previous = new Date(sorted[i - 1]);
    const current = new Date(sorted[i]);
    const diff = Math.round((previous.getTime() - current.getTime()) / 86400000);
    if (diff === 1) {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

const computeCurrentCorrectStreak = (sessions: SessionRecord[]): number => {
  let streak = 0;
  const timeline = sessions.flatMap((session) => session.results);

  for (let i = timeline.length - 1; i >= 0; i -= 1) {
    const outcome = timeline[i]?.outcome;
    if (outcome === "first_try" || outcome === "second_try") {
      streak += 1;
    } else {
      break;
    }
  }

  return streak;
};

const computeLongestCorrectStreak = (sessions: SessionRecord[]): number => {
  let best = 0;
  let current = 0;

  sessions.forEach((session) => {
    session.results.forEach((result) => {
      if (result.outcome === "first_try" || result.outcome === "second_try") {
        current += 1;
        best = Math.max(best, current);
      } else {
        current = 0;
      }
    });
  });

  return best;
};

const dedupeRecent = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const output: string[] = [];

  ids.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id);
      output.push(id);
    }
  });

  return output.slice(0, 120);
};

const applyAchievements = (
  data: AppData,
  session: SessionRecord,
  masteredCount: number,
  nowIso: string
): Record<string, AchievementState> => {
  const achievements = { ...data.achievements };

  achievements.streak_10 = updateAchievement(achievements.streak_10, data.stats.currentStreak, nowIso);
  achievements.streak_25 = updateAchievement(achievements.streak_25, data.stats.currentStreak, nowIso);
  achievements.streak_50 = updateAchievement(achievements.streak_50, data.stats.currentStreak, nowIso);

  achievements.q_100 = updateAchievement(
    achievements.q_100,
    data.stats.totalQuestionsAnswered,
    nowIso
  );
  achievements.q_500 = updateAchievement(
    achievements.q_500,
    data.stats.totalQuestionsAnswered,
    nowIso
  );

  achievements.mastered_25 = updateAchievement(achievements.mastered_25, masteredCount, nowIso);
  achievements.mastered_100 = updateAchievement(achievements.mastered_100, masteredCount, nowIso);

  if (session.mode === "weak_words") {
    achievements.weak_session = updateAchievement(achievements.weak_session, 1, nowIso);
  }

  if (session.accuracy >= 0.9 && session.questionCount >= 10) {
    achievements.session_90 = updateAchievement(achievements.session_90, 1, nowIso);
  }

  achievements.sessions_7 = updateAchievement(achievements.sessions_7, data.stats.totalSessions, nowIso);

  const dayStreak = consecutiveStudyDays(Object.keys(data.dailyHistory));
  achievements.streak_days_5 = updateAchievement(achievements.streak_days_5, dayStreak, nowIso);

  return achievements;
};

const recommendedAction = (session: SessionRecord): string => {
  if (session.missed >= Math.max(3, Math.round(session.questionCount * 0.25))) {
    return "Review missed words next while they are fresh.";
  }

  if (session.secondTryCorrect >= 4) {
    return "Run a weak-words session to reinforce shaky recalls.";
  }

  if (session.accuracy >= 0.9) {
    return "Great accuracy. Move to mixed mode with fresh words.";
  }

  return "Continue with a short mixed session to stabilize retention.";
};

export const commitSessionResults = (
  data: AppData,
  wordsById: Map<string, VocabWord>,
  input: SessionBuildInput
): { updated: AppData; summary: SessionSummary } => {
  const session = buildSessionRecord(input);
  const nowIso = input.endedAt;
  const updated: AppData = {
    ...data,
    sessions: [...data.sessions, session].slice(-MAX_SESSIONS),
    wordProgress: { ...data.wordProgress },
    modeStats: { ...data.modeStats },
    dailyHistory: { ...data.dailyHistory },
    stats: { ...data.stats },
    achievements: { ...data.achievements },
    lastUpdatedAt: nowIso,
  };

  session.results.forEach((result) => {
    const previous = updated.wordProgress[result.wordId] ?? createEmptyWordProgress(result.wordId);
    updated.wordProgress[result.wordId] = applyWordOutcome(
      previous,
      result.wordId,
      result.outcome,
      result.responseMs,
      result.mode,
      result.questionType,
      nowIso
    );

    const modeStat = updated.modeStats[result.questionType];
    modeStat.answered += 1;
    modeStat.totalResponseMs += result.responseMs;
    if (result.outcome === "first_try") modeStat.firstTryCorrect += 1;
    if (result.outcome === "second_try") modeStat.secondTryCorrect += 1;
    if (result.outcome === "missed") modeStat.missed += 1;
    if (result.outcome === "skipped") modeStat.skipped += 1;
  });

  const todaysKey = todayKey(new Date(nowIso));
  const dailyEntry = updated.dailyHistory[todaysKey] ?? {
    date: todaysKey,
    questions: 0,
    sessions: 0,
    firstTryCorrect: 0,
    secondTryCorrect: 0,
    missed: 0,
  };

  dailyEntry.questions += session.questionCount;
  dailyEntry.sessions += 1;
  dailyEntry.firstTryCorrect += session.firstTryCorrect;
  dailyEntry.secondTryCorrect += session.secondTryCorrect;
  dailyEntry.missed += session.missed;
  updated.dailyHistory[todaysKey] = dailyEntry;

  updated.stats.totalQuestionsAnswered += session.questionCount;
  updated.stats.totalSessions += 1;
  updated.stats.firstTryCorrect += session.firstTryCorrect;
  updated.stats.secondTryCorrect += session.secondTryCorrect;
  updated.stats.missed += session.missed;
  updated.stats.skipped += session.skipped;
  updated.stats.lastPracticedAt = nowIso;

  const allSessions = updated.sessions;
  updated.stats.currentStreak = computeCurrentCorrectStreak(allSessions);
  updated.stats.longestStreak = Math.max(
    updated.stats.longestStreak,
    computeLongestCorrectStreak(allSessions)
  );

  const allResponses = allSessions.map((entry) => entry.averageResponseMs).filter((value) => value > 0);
  updated.stats.averageResponseMs = average(allResponses);

  updated.recentWordIds = dedupeRecent([
    ...session.wordIds.slice().reverse(),
    ...updated.recentWordIds,
  ]);

  const masteredCount = Array.from(wordsById.keys()).filter(
    (wordId) => wordStatus(updated.wordProgress[wordId]) === "mastered"
  ).length;

  updated.achievements = applyAchievements(updated, session, masteredCount, nowIso);

  const struggledWords = session.difficultWordIds;
  const strongWords = session.strongestWordIds;

  return {
    updated,
    summary: {
      session,
      struggledWords,
      strongWords,
      recommendedAction: recommendedAction(session),
    },
  };
};

export const outcomeLabel = (outcome: AttemptOutcome): string => {
  if (outcome === "first_try") return "Correct on first try";
  if (outcome === "second_try") return "Recovered on second try";
  if (outcome === "missed") return "Missed after two tries";
  return "Skipped";
};
