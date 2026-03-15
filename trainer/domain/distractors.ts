import { VocabWord } from "../types";
import { normalizeAnswer, shuffle } from "../utils/text";

const tokenize = (text: string): Set<string> => {
  return new Set(
    normalizeAnswer(text)
      .split(" ")
      .filter((token) => token.length > 3)
  );
};

const overlapScore = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;

  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) overlap += 1;
  }
  return overlap / Math.max(a.size, b.size);
};

const candidateScore = (target: VocabWord, candidate: VocabWord): number => {
  if (target.id === candidate.id) return -1;

  const posScore = target.partOfSpeech && target.partOfSpeech === candidate.partOfSpeech ? 1.25 : 0;
  const groupScore = target.sourceGroup && target.sourceGroup === candidate.sourceGroup ? 0.45 : 0;
  const diffScore =
    target.difficulty !== undefined && candidate.difficulty !== undefined
      ? Math.max(0, 1 - Math.abs(target.difficulty - candidate.difficulty) / 6)
      : 0.25;

  const lengthScore = Math.max(
    0,
    1 - Math.abs(target.word.length - candidate.word.length) / Math.max(target.word.length, 1)
  );

  const definitionOverlap = overlapScore(tokenize(target.definition), tokenize(candidate.definition));

  const synonymOverlap =
    target.synonyms.length && candidate.synonyms.length
      ? overlapScore(new Set(target.synonyms.map(normalizeAnswer)), new Set(candidate.synonyms.map(normalizeAnswer)))
      : 0;

  return posScore + groupScore + diffScore + lengthScore * 0.4 + definitionOverlap * 1.6 + synonymOverlap;
};

export const pickDistractors = (
  target: VocabWord,
  allWords: VocabWord[],
  count = 3
): VocabWord[] => {
  const sorted = allWords
    .filter((word) => word.id !== target.id)
    .map((word) => ({ word, score: candidateScore(target, word) }))
    .sort((a, b) => b.score - a.score);

  const topCandidates = sorted.slice(0, Math.max(12, count * 3)).map((item) => item.word);
  const shuffledTop = shuffle(topCandidates);

  const selected: VocabWord[] = [];
  for (const candidate of shuffledTop) {
    if (selected.length >= count) {
      break;
    }

    if (!selected.find((word) => word.id === candidate.id)) {
      selected.push(candidate);
    }
  }

  if (selected.length < count) {
    for (const fallback of shuffle(allWords)) {
      if (selected.length >= count) break;
      if (fallback.id === target.id) continue;
      if (!selected.find((word) => word.id === fallback.id)) {
        selected.push(fallback);
      }
    }
  }

  return selected.slice(0, count);
};
