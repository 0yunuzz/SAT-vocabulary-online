import { AppData, ModeStats, QuestionType, VocabWord } from "../types";
import { wordStatus } from "./mastery";

export interface DashboardMetrics {
  totalWords: number;
  wordsPracticed: number;
  masteredWords: number;
  weakWords: number;
  bookmarkedWords: number;
  overallAccuracy: number;
  firstTryAccuracy: number;
  secondTryRecovery: number;
  currentStreak: number;
  longestStreak: number;
  avgResponseMs: number;
}

export const modeAccuracy = (mode: ModeStats): number => {
  if (!mode.answered) return 0;
  return (mode.firstTryCorrect + mode.secondTryCorrect) / mode.answered;
};

export const buildDashboardMetrics = (words: VocabWord[], data: AppData): DashboardMetrics => {
  const practiced = words.filter((word) => (data.wordProgress[word.id]?.timesSeen ?? 0) > 0);
  const mastered = words.filter((word) => wordStatus(data.wordProgress[word.id]) === "mastered");
  const weak = words.filter((word) => wordStatus(data.wordProgress[word.id]) === "weak");

  const answered = data.stats.totalQuestionsAnswered || 1;
  const overallAccuracy = (data.stats.firstTryCorrect + data.stats.secondTryCorrect) / answered;
  const firstTryAccuracy = data.stats.firstTryCorrect / answered;

  const attemptsWithSecondChance = data.stats.secondTryCorrect + data.stats.missed;
  const secondTryRecovery =
    attemptsWithSecondChance > 0 ? data.stats.secondTryCorrect / attemptsWithSecondChance : 0;

  return {
    totalWords: words.length,
    wordsPracticed: practiced.length,
    masteredWords: mastered.length,
    weakWords: weak.length,
    bookmarkedWords: data.bookmarks.length,
    overallAccuracy,
    firstTryAccuracy,
    secondTryRecovery,
    currentStreak: data.stats.currentStreak,
    longestStreak: data.stats.longestStreak,
    avgResponseMs: data.stats.averageResponseMs,
  };
};

export const mostMissedWords = (words: VocabWord[], data: AppData, limit = 8): VocabWord[] => {
  return [...words]
    .sort((a, b) => (data.wordProgress[b.id]?.missed ?? 0) - (data.wordProgress[a.id]?.missed ?? 0))
    .filter((word) => (data.wordProgress[word.id]?.missed ?? 0) > 0)
    .slice(0, limit);
};

export const leastSeenWords = (words: VocabWord[], data: AppData, limit = 8): VocabWord[] => {
  return [...words]
    .sort((a, b) => (data.wordProgress[a.id]?.timesSeen ?? 0) - (data.wordProgress[b.id]?.timesSeen ?? 0))
    .slice(0, limit);
};

export const recentSessions = (data: AppData, limit = 5) => [...data.sessions].slice(-limit).reverse();

export const studyActivity = (data: AppData, days = 14): { date: string; questions: number }[] => {
  const points: { date: string; questions: number }[] = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push({
      date: key,
      questions: data.dailyHistory[key]?.questions ?? 0,
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
