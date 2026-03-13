import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { createEmptySnapshot, mergeSnapshots, normalizeSnapshot } from "@/lib/snapshot";
import type { MergeStrategy, ProgressSnapshot } from "@/lib/types";

async function ensureAchievementCatalog(db: PrismaClient | Prisma.TransactionClient) {
  await Promise.all(
    ACHIEVEMENTS.map((achievement) =>
      db.achievement.upsert({
        where: { key: achievement.key },
        create: achievement,
        update: {
          title: achievement.title,
          description: achievement.description,
          points: achievement.points
        }
      })
    )
  );
}

async function upsertWord(
  db: PrismaClient | Prisma.TransactionClient,
  word: string,
  definition: string,
  exampleSentence: string
) {
  return db.word.upsert({
    where: { word },
    create: {
      word,
      definition: definition || "Definition unavailable",
      exampleSentence: exampleSentence || "Example sentence unavailable"
    },
    update: {
      definition: definition || "Definition unavailable",
      exampleSentence: exampleSentence || "Example sentence unavailable"
    }
  });
}

async function writeSnapshotData(
  tx: Prisma.TransactionClient,
  userId: string,
  snapshot: ProgressSnapshot
) {
  await ensureAchievementCatalog(tx);

  const progressItems = Object.values(snapshot.wordProgress);
  for (const progress of progressItems) {
    const word = await upsertWord(
      tx,
      progress.word,
      progress.definition,
      progress.exampleSentence
    );

    await tx.userWordProgress.upsert({
      where: {
        userId_wordId: {
          userId,
          wordId: word.id
        }
      },
      create: {
        userId,
        wordId: word.id,
        masteryScore: progress.masteryScore,
        attempts: progress.attempts,
        correctAnswers: progress.correctAnswers,
        incorrectAnswers: progress.incorrectAnswers,
        lastReviewed: progress.lastReviewed ? new Date(progress.lastReviewed) : null,
        averageResponseMs: progress.averageResponseMs,
        lastResponseMs: progress.lastResponseMs ?? null,
        needsRetry: progress.needsRetry,
        isWeak: progress.isWeak,
        missedCount: progress.missedCount,
        lastResult: progress.lastResult ?? null
      },
      update: {
        masteryScore: progress.masteryScore,
        attempts: progress.attempts,
        correctAnswers: progress.correctAnswers,
        incorrectAnswers: progress.incorrectAnswers,
        lastReviewed: progress.lastReviewed ? new Date(progress.lastReviewed) : null,
        averageResponseMs: progress.averageResponseMs,
        lastResponseMs: progress.lastResponseMs ?? null,
        needsRetry: progress.needsRetry,
        isWeak: progress.isWeak,
        missedCount: progress.missedCount,
        lastResult: progress.lastResult ?? null
      }
    });
  }

  for (const wordText of snapshot.bookmarks) {
    const progress = snapshot.wordProgress[wordText];
    const word = await upsertWord(
      tx,
      wordText,
      progress?.definition ?? "Definition unavailable",
      progress?.exampleSentence ?? "Example sentence unavailable"
    );

    await tx.bookmark.upsert({
      where: {
        userId_wordId: {
          userId,
          wordId: word.id
        }
      },
      create: { userId, wordId: word.id },
      update: {}
    });
  }

  for (const item of snapshot.sessions) {
    await tx.studySession.upsert({
      where: { id: item.id },
      create: {
        id: item.id,
        userId,
        mode: item.mode,
        totalQuestions: item.totalQuestions,
        correctAnswers: item.correctAnswers,
        startedAt: new Date(item.startedAt),
        endedAt: new Date(item.endedAt),
        durationSec: item.durationSec,
        accuracy: item.accuracy
      },
      update: {
        mode: item.mode,
        totalQuestions: item.totalQuestions,
        correctAnswers: item.correctAnswers,
        startedAt: new Date(item.startedAt),
        endedAt: new Date(item.endedAt),
        durationSec: item.durationSec,
        accuracy: item.accuracy
      }
    });
  }

  for (const key of snapshot.achievements) {
    const achievement = await tx.achievement.upsert({
      where: { key },
      create: {
        key,
        title: key,
        description: "Custom achievement",
        points: 10
      },
      update: {}
    });

    await tx.userAchievement.upsert({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id
        }
      },
      create: { userId, achievementId: achievement.id },
      update: {}
    });
  }

  await tx.streak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: snapshot.streak.currentStreak,
      longestStreak: snapshot.streak.longestStreak,
      lastStudyDate: snapshot.streak.lastStudyDate
        ? new Date(snapshot.streak.lastStudyDate)
        : null
    },
    update: {
      currentStreak: snapshot.streak.currentStreak,
      longestStreak: snapshot.streak.longestStreak,
      lastStudyDate: snapshot.streak.lastStudyDate
        ? new Date(snapshot.streak.lastStudyDate)
        : null
    }
  });
}

export async function getAccountSnapshot(userId: string): Promise<ProgressSnapshot> {
  const [progressRows, bookmarks, sessions, achievements, streak] = await prisma.$transaction([
    prisma.userWordProgress.findMany({
      where: { userId },
      include: { word: true }
    }),
    prisma.bookmark.findMany({
      where: { userId },
      include: { word: true }
    }),
    prisma.studySession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 200
    }),
    prisma.userAchievement.findMany({
      where: { userId },
      include: { achievement: true }
    }),
    prisma.streak.findUnique({ where: { userId } })
  ]);

  const snapshot = createEmptySnapshot();
  const progressMap: ProgressSnapshot["wordProgress"] = {};

  progressRows.forEach((row) => {
    progressMap[row.word.word] = {
      word: row.word.word,
      definition: row.word.definition,
      exampleSentence: row.word.exampleSentence,
      masteryScore: row.masteryScore,
      attempts: row.attempts,
      correctAnswers: row.correctAnswers,
      incorrectAnswers: row.incorrectAnswers,
      lastReviewed: row.lastReviewed?.toISOString(),
      averageResponseMs: row.averageResponseMs,
      lastResponseMs: row.lastResponseMs ?? undefined,
      needsRetry: row.needsRetry,
      isWeak: row.isWeak,
      missedCount: row.missedCount,
      lastResult:
        row.lastResult === "correct" || row.lastResult === "incorrect"
          ? row.lastResult
          : undefined,
      updatedAt: row.updatedAt.toISOString()
    };
  });

  snapshot.wordProgress = progressMap;
  snapshot.bookmarks = bookmarks.map((entry) => entry.word.word);
  snapshot.recentWords = Object.values(progressMap)
    .sort(
      (a, b) =>
        +(b.lastReviewed ? new Date(b.lastReviewed) : 0) -
        +(a.lastReviewed ? new Date(a.lastReviewed) : 0)
    )
    .slice(0, 50)
    .map((entry) => entry.word);
  snapshot.sessions = sessions.map((item) => ({
    id: item.id,
    mode: item.mode as ProgressSnapshot["sessions"][number]["mode"],
    totalQuestions: item.totalQuestions,
    correctAnswers: item.correctAnswers,
    startedAt: item.startedAt.toISOString(),
    endedAt: item.endedAt.toISOString(),
    durationSec: item.durationSec,
    accuracy: item.accuracy
  }));
  snapshot.achievements = achievements.map((item) => item.achievement.key);
  snapshot.streak = {
    currentStreak: streak?.currentStreak ?? 0,
    longestStreak: streak?.longestStreak ?? 0,
    lastStudyDate: streak?.lastStudyDate?.toISOString()
  };
  snapshot.updatedAt = new Date().toISOString();

  return normalizeSnapshot(snapshot);
}

export async function replaceAccountSnapshot(
  userId: string,
  snapshot: ProgressSnapshot
): Promise<ProgressSnapshot> {
  const normalized = normalizeSnapshot(snapshot);

  await prisma.$transaction(async (tx) => {
    await tx.userWordProgress.deleteMany({ where: { userId } });
    await tx.bookmark.deleteMany({ where: { userId } });
    await tx.studySession.deleteMany({ where: { userId } });
    await tx.userAchievement.deleteMany({ where: { userId } });
    await tx.streak.deleteMany({ where: { userId } });
    await writeSnapshotData(tx, userId, normalized);
  });

  return getAccountSnapshot(userId);
}

export async function syncAccountSnapshot(
  userId: string,
  incoming: ProgressSnapshot
): Promise<ProgressSnapshot> {
  const account = await getAccountSnapshot(userId);
  const merged = mergeSnapshots(account, normalizeSnapshot(incoming));
  return replaceAccountSnapshot(userId, merged);
}

export async function mergeGuestIntoAccount(
  userId: string,
  localSnapshot: ProgressSnapshot,
  strategy: MergeStrategy
): Promise<ProgressSnapshot> {
  if (strategy === "replace_account") {
    return replaceAccountSnapshot(userId, localSnapshot);
  }

  const account = await getAccountSnapshot(userId);
  if (strategy === "keep_account") {
    return account;
  }

  const merged = mergeSnapshots(account, localSnapshot);
  return replaceAccountSnapshot(userId, merged);
}
