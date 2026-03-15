import { AppData, VocabWord, WordProgress } from "../types";
import { daysBetween } from "../utils/date";
import { clamp, shuffle } from "../utils/text";
import { wordStatus } from "./mastery";

export interface WeightedWord {
  word: VocabWord;
  weakness: number;
  due: boolean;
}

const recentMissWeight = (progress?: WordProgress): number => {
  if (!progress?.recentEvents.length) {
    return 0;
  }

  return progress.recentEvents.slice(0, 5).reduce((sum, event, index) => {
    const recencyFactor = 1 - index * 0.15;
    if (event.outcome === "missed") return sum + 0.25 * recencyFactor;
    if (event.outcome === "second_try") return sum + 0.14 * recencyFactor;
    return sum;
  }, 0);
};

export const computeWeaknessScore = (
  word: VocabWord,
  progress: WordProgress | undefined,
  nowIso: string
): number => {
  if (!progress) {
    return 1;
  }

  const missRate = progress.missed / Math.max(progress.timesSeen, 1);
  const firstTryMissRate =
    1 - progress.firstTryCorrect / Math.max(progress.timesSeen - progress.skipped, 1);
  const secondTryReliance = progress.secondTryReliance / Math.max(progress.timesSeen, 1);
  const avgResponseSec = progress.totalResponseMs / Math.max(progress.timesSeen, 1) / 1000;
  const speedPenalty = clamp((avgResponseSec - 8) / 12, 0, 0.45);
  const timeSinceSeen = daysBetween(progress.lastSeenAt, nowIso);
  const freshnessBonus = clamp(timeSinceSeen / 14, 0, 0.5);

  const overdue = progress.nextDueAt ? new Date(progress.nextDueAt).getTime() <= Date.now() : true;
  const dueBonus = overdue ? 0.4 : 0;
  const cooldownPenalty = timeSinceSeen <= 1 ? 0.4 : 0;

  const weakness =
    0.2 +
    missRate * 0.9 +
    firstTryMissRate * 0.85 +
    secondTryReliance * 0.45 +
    speedPenalty +
    recentMissWeight(progress) +
    freshnessBonus +
    dueBonus -
    progress.masteryScore / 150 -
    cooldownPenalty;

  const difficultyBoost = word.difficulty ? clamp(word.difficulty / 20, 0, 0.25) : 0;
  return clamp(weakness + difficultyBoost, 0.05, 2.2);
};

export const rankWordsForReview = (words: VocabWord[], data: AppData): WeightedWord[] => {
  const now = new Date().toISOString();

  return words
    .map((word) => {
      const progress = data.wordProgress[word.id];
      const weakness = computeWeaknessScore(word, progress, now);
      const due = progress?.nextDueAt ? new Date(progress.nextDueAt).getTime() <= Date.now() : true;
      return { word, weakness, due };
    })
    .sort((a, b) => b.weakness - a.weakness);
};

const weightedPick = (pool: WeightedWord[]): WeightedWord | null => {
  const totalWeight = pool.reduce((sum, item) => sum + item.weakness, 0);
  if (!totalWeight) {
    return null;
  }

  let threshold = Math.random() * totalWeight;
  for (const item of pool) {
    threshold -= item.weakness;
    if (threshold <= 0) {
      return item;
    }
  }

  return pool[pool.length - 1] ?? null;
};

export const selectAdaptiveWords = (
  words: VocabWord[],
  data: AppData,
  count: number
): VocabWord[] => {
  if (count <= 0) {
    return [];
  }

  const ranked = rankWordsForReview(words, data);
  if (ranked.length <= count) {
    return shuffle(ranked.map((item) => item.word));
  }

  const weakCutoff = Math.max(1, Math.floor(count * 0.72));
  const weakPool = ranked.filter((item) => item.weakness > 0.8);
  const broadPool = ranked.filter((item) => item.weakness <= 0.8 || !weakPool.includes(item));

  const selected = new Map<string, VocabWord>();
  const pickFromPool = (pool: WeightedWord[], targetCount: number): void => {
    const mutablePool = [...pool];

    while (selected.size < targetCount && mutablePool.length) {
      const picked = weightedPick(mutablePool);
      if (!picked) break;
      selected.set(picked.word.id, picked.word);
      const idx = mutablePool.findIndex((item) => item.word.id === picked.word.id);
      if (idx >= 0) {
        mutablePool.splice(idx, 1);
      }
    }
  };

  pickFromPool(weakPool.length ? weakPool : ranked, weakCutoff);
  pickFromPool(broadPool.length ? broadPool : ranked, count);

  if (selected.size < count) {
    for (const item of ranked) {
      if (selected.size >= count) break;
      selected.set(item.word.id, item.word);
    }
  }

  const selectedWords = [...selected.values()].slice(0, count);
  return shuffle(selectedWords);
};

export const classifyWordSets = (words: VocabWord[], data: AppData) => {
  const weak: VocabWord[] = [];
  const mastered: VocabWord[] = [];
  const unseen: VocabWord[] = [];
  const learning: VocabWord[] = [];

  words.forEach((word) => {
    const status = wordStatus(data.wordProgress[word.id]);
    if (status === "weak") weak.push(word);
    if (status === "mastered") mastered.push(word);
    if (status === "unseen") unseen.push(word);
    if (status === "learning") learning.push(word);
  });

  return { weak, mastered, unseen, learning };
};
