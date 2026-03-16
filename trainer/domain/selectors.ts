import { AppData, ModeStats, QuestionType, VocabWord } from "../types";
import { wordStatus } from "./mastery";
import { todayKey } from "../utils/date";

export interface DashboardMetrics {
  totalQuestionsSolved: number;
  overallAccuracy: number;
  currentStreak: number;
}

export const modeAccuracy = (mode: ModeStats): number => {
  if (!mode.answered) return 0;
  return (mode.firstTryCorrect + mode.secondTryCorrect) / mode.answered;
};

export const buildDashboardMetrics = (data: AppData): DashboardMetrics => {
  const answered = data.stats.totalQuestionsAnswered || 1;
  const overallAccuracy = (data.stats.firstTryCorrect + data.stats.secondTryCorrect) / answered;

  return {
    totalQuestionsSolved: data.stats.totalQuestionsAnswered,
    overallAccuracy,
    currentStreak: data.stats.currentStreak
  };
};

export const mostMissedWords = (words: VocabWord[], data: AppData, limit = 8): VocabWord[] => {
  return [...words]
    .sort((a, b) => (data.wordProgress[b.id]?.missed ?? 0) - (data.wordProgress[a.id]?.missed ?? 0))
    .filter((word) => (data.wordProgress[word.id]?.missed ?? 0) > 0)
    .slice(0, limit);
};

export const recentSessions = (data: AppData, limit = 5) => [...data.sessions].slice(-limit).reverse();

export const studyActivity = (data: AppData, days = 14): { date: string; questions: number }[] => {
  const points: { date: string; questions: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = todayKey(d);
    const fallbackKey = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      questions: data.dailyHistory[key]?.questions ?? data.dailyHistory[fallbackKey]?.questions ?? 0
    });
  }

  return points;
};

export const masteryDistribution = (words: VocabWord[], data: AppData) => {
  const distribution = {
    unseen: 0,
    weak: 0,
    learning: 0,
    mastered: 0,
  };

  words.forEach((word) => {
    const status = wordStatus(data.wordProgress[word.id]);
    distribution[status] += 1;
  });

  return distribution;
};

export const modeBreakdown = (data: AppData): { type: QuestionType; accuracy: number; answered: number }[] => {
  return (Object.keys(data.modeStats) as QuestionType[]).map((type) => ({
    type,
    accuracy: modeAccuracy(data.modeStats[type]),
    answered: data.modeStats[type].answered,
  }));
};

export interface DetailedStatistics {
  averageResponseMs: number;
  longestStreak: number;
  firstTryAccuracy: number;
  secondTryAccuracy: number;
  weakWordCount: number;
  wordsPracticed: number;
  masteredWords: number;
  totalSessions: number;
  averageQuestionsPerSession: number;
  sevenDayQuestions: number;
  sevenDayAccuracy: number;
}

export const buildDetailedStatistics = (
  words: VocabWord[],
  data: AppData
): DetailedStatistics => {
  const answered = data.stats.totalQuestionsAnswered || 1;
  const firstTryAccuracy = data.stats.firstTryCorrect / answered;
  const secondChanceAttempts = data.stats.secondTryCorrect + data.stats.missed;
  const secondTryAccuracy =
    secondChanceAttempts > 0 ? data.stats.secondTryCorrect / secondChanceAttempts : 0;

  const wordsPracticed = words.filter((word) => (data.wordProgress[word.id]?.timesSeen ?? 0) > 0)
    .length;
  const masteredWords = words.filter(
    (word) => wordStatus(data.wordProgress[word.id]) === "mastered"
  ).length;
  const weakWordCount = words.filter((word) => wordStatus(data.wordProgress[word.id]) === "weak")
    .length;

  const recentDays = studyActivity(data, 7);
  const sevenDayQuestions = recentDays.reduce((sum, day) => sum + day.questions, 0);
  const recentSessions = data.sessions.slice(-20);
  const recentAnswered = recentSessions.reduce((sum, session) => sum + session.questionCount, 0);
  const recentCorrect = recentSessions.reduce(
    (sum, session) => sum + session.firstTryCorrect + session.secondTryCorrect,
    0
  );

  return {
    averageResponseMs: data.stats.averageResponseMs,
    longestStreak: data.stats.longestStreak,
    firstTryAccuracy,
    secondTryAccuracy,
    weakWordCount,
    wordsPracticed,
    masteredWords,
    totalSessions: data.stats.totalSessions,
    averageQuestionsPerSession:
      data.stats.totalSessions > 0 ? data.stats.totalQuestionsAnswered / data.stats.totalSessions : 0,
    sevenDayQuestions,
    sevenDayAccuracy: recentAnswered > 0 ? recentCorrect / recentAnswered : 0
  };
};
