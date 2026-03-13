import type { ProgressSnapshot, SessionRecord } from "@/lib/types";

export interface AchievementDefinition {
  key: string;
  title: string;
  description: string;
  points: number;
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    key: "first_correct",
    title: "First Win",
    description: "Answer your first question correctly.",
    points: 5
  },
  {
    key: "focused_session",
    title: "Focused Session",
    description: "Finish a session with at least 10 questions.",
    points: 10
  },
  {
    key: "high_accuracy",
    title: "Sharp Accuracy",
    description: "Finish a session with at least 90% accuracy.",
    points: 15
  },
  {
    key: "bookmarked_25",
    title: "Collector",
    description: "Bookmark 25 words.",
    points: 15
  },
  {
    key: "attempts_100",
    title: "Century Practice",
    description: "Reach 100 total attempts.",
    points: 20
  },
  {
    key: "streak_7",
    title: "One-Week Streak",
    description: "Study 7 days in a row.",
    points: 25
  }
];

export function evaluateAchievements(
  snapshot: ProgressSnapshot,
  latestSession: SessionRecord
): string[] {
  const unlocked = new Set(snapshot.achievements);
  const totalAttempts = Object.values(snapshot.wordProgress).reduce(
    (sum, item) => sum + item.attempts,
    0
  );
  const anyCorrect = Object.values(snapshot.wordProgress).some(
    (item) => item.correctAnswers > 0
  );

  if (anyCorrect) unlocked.add("first_correct");
  if (latestSession.totalQuestions >= 10) unlocked.add("focused_session");
  if (latestSession.accuracy >= 0.9 && latestSession.totalQuestions >= 10) {
    unlocked.add("high_accuracy");
  }
  if (snapshot.bookmarks.length >= 25) unlocked.add("bookmarked_25");
  if (totalAttempts >= 100) unlocked.add("attempts_100");
  if (snapshot.streak.currentStreak >= 7) unlocked.add("streak_7");

  return Array.from(unlocked);
}
