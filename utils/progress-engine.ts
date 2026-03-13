import type {
  PracticeMode,
  QuizQuestion,
  VocabWord,
  WordProgress
} from "@/lib/types";

function randomItem<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffled<T>(list: T[]): T[] {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function toComparable(value: string): string {
  return value.trim().toLowerCase();
}

function createQuestionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getLeadingLetter(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  return normalized[0];
}

function countDistinctLeadingLetters(words: VocabWord[]): number {
  const letters = new Set(words.map((entry) => getLeadingLetter(entry.word)).filter(Boolean));
  return letters.size;
}

function buildWordForms(word: string): string[] {
  const parts = word
    .toLowerCase()
    .split(/\s*(?:\/|,|;|\bor\b|\|)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const forms = new Set<string>();

  const addForms = (base: string) => {
    forms.add(base);
    if (!/^[a-z]+$/.test(base)) return;

    if (base.endsWith("e")) {
      forms.add(`${base}d`);
      forms.add(`${base.slice(0, -1)}ing`);
    } else {
      forms.add(`${base}ed`);
      forms.add(`${base}ing`);
    }

    if (/[^aeiou]y$/.test(base)) {
      forms.add(`${base.slice(0, -1)}ies`);
      forms.add(`${base.slice(0, -1)}ied`);
    }

    if (/(s|x|z|ch|sh)$/.test(base)) {
      forms.add(`${base}es`);
    } else {
      forms.add(`${base}s`);
    }
  };

  parts.forEach(addForms);

  return Array.from(forms).sort((a, b) => b.length - a.length);
}

function selectSentenceVariant(sentence: string): string {
  const variants = sentence
    .split("|")
    .map((part) => part.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
  if (variants.length === 0) return sentence.trim();
  return randomItem(variants);
}

function stripWordFromSentence(
  word: string,
  sentence: string
): { prompt: string; replaced: boolean } {
  const forms = buildWordForms(word);
  let prompt = sentence;
  let replacements = 0;

  for (const form of forms) {
    const regex = new RegExp(`\\b${escapeRegExp(form)}\\b`, "gi");
    const matches = prompt.match(regex);
    if (!matches) continue;
    replacements += matches.length;
    prompt = prompt.replace(regex, "_____");
  }

  if (replacements === 0) {
    const lowerWord = word.trim().toLowerCase();
    if (/^[a-z]{4,}$/.test(lowerWord)) {
      const stem = lowerWord.endsWith("e") ? lowerWord.slice(0, -1) : lowerWord;
      const stemRegex = new RegExp(`\\b${escapeRegExp(stem)}[a-z]*\\b`, "gi");
      const stemMatches = prompt.match(stemRegex);
      if (stemMatches) {
        replacements += stemMatches.length;
        prompt = prompt.replace(stemRegex, "_____");
      }
    }
  }

  return { prompt, replaced: replacements > 0 };
}

function buildDefinitionToWordQuestion(
  sourceWord: VocabWord,
  words: VocabWord[]
): QuizQuestion {
  const distractors = shuffled(
    words
      .filter((entry) => toComparable(entry.word) !== toComparable(sourceWord.word))
      .map((entry) => entry.word)
  ).slice(0, 3);
  const correctChoice = sourceWord.word;
  const choices = shuffled([correctChoice, ...distractors]);

  return {
    id: createQuestionId(),
    mode: "definition_to_word",
    sourceWord,
    prompt: sourceWord.definition,
    choices,
    correctChoice,
    helperText: "Choose the matching SAT word."
  };
}

function resolveCoreMode(
  mode: PracticeMode,
  words: VocabWord[],
  progress: Record<string, WordProgress>
): QuizQuestion["mode"] {
  if (mode === "mixed") {
    return randomItem([
      "word_to_definition",
      "definition_to_word",
      "sentence_context"
    ]);
  }
  if (mode === "weak_words" || mode === "missed_words") {
    return randomItem(["word_to_definition", "definition_to_word"]);
  }
  return mode;
}

function chooseCandidateWords(
  mode: PracticeMode,
  words: VocabWord[],
  progress: Record<string, WordProgress>
): VocabWord[] {
  if (mode === "weak_words") {
    const weakWords = words.filter((entry) => {
      const item = progress[entry.word];
      return item ? item.masteryScore < 0.6 || item.isWeak : false;
    });

    if (weakWords.length === 0) {
      return words;
    }

    const distinctLetters = countDistinctLeadingLetters(weakWords);
    const shouldBlend = weakWords.length < 14 || distinctLetters < 4;
    if (!shouldBlend) {
      return weakWords;
    }

    const weakWordSet = new Set(weakWords.map((entry) => entry.word));
    const otherWords = words.filter((entry) => !weakWordSet.has(entry.word));
    if (otherWords.length === 0) {
      return weakWords;
    }

    const extraCount = Math.min(
      otherWords.length,
      Math.max(10, weakWords.length)
    );

    return [...weakWords, ...shuffled(otherWords).slice(0, extraCount)];
  }

  if (mode === "missed_words") {
    const missedWords = words.filter((entry) => {
      const item = progress[entry.word];
      return item ? item.missedCount > 0 || item.incorrectAnswers > 0 : false;
    });
    return missedWords.length > 0 ? missedWords : words;
  }

  return words;
}

function weightedWordChoice(
  words: VocabWord[],
  progress: Record<string, WordProgress>,
  mode: PracticeMode,
  recentWords: string[]
): VocabWord {
  const recentSet = new Set(
    recentWords.slice(0, 8).map((entry) => toComparable(entry))
  );
  const recentLetters = recentWords
    .slice(0, 8)
    .map((entry) => getLeadingLetter(entry))
    .filter(Boolean);
  const lastLetter = recentLetters[0] ?? "";

  const withWeight = shuffled(words).map((word) => {
    const state = progress[word.word];
    const isWeak = state ? state.masteryScore < 0.6 || state.isWeak : false;
    const isMissed = state ? state.missedCount > 0 || state.incorrectAnswers > 0 : false;
    let weight = 2;

    if (!state) {
      weight = mode === "weak_words" || mode === "missed_words" ? 1 : 2.1;
    } else {
      const weaknessBoost = (1 - state.masteryScore) * 4;
      const missedBoost = state.missedCount * 1.5;
      const retryBoost = state.needsRetry ? 3 : 0;
      weight = Math.max(1, weaknessBoost + missedBoost + retryBoost + 1);
    }

    if (mode === "weak_words") {
      weight *= isWeak ? 2.7 : 0.65;
    } else if (mode === "missed_words") {
      weight *= isMissed ? 2.7 : 0.65;
    }

    const normalizedWord = toComparable(word.word);
    if (recentSet.has(normalizedWord)) {
      weight *= 0.18;
    }

    const currentLetter = getLeadingLetter(word.word);
    if (currentLetter && recentLetters.length > 0) {
      const letterCount = recentLetters.filter((letter) => letter === currentLetter).length;
      if (letterCount > 0) {
        weight *= 1 / (1 + letterCount * 0.55);
      }
      if (lastLetter && currentLetter === lastLetter) {
        weight *= 0.5;
      }
    }

    return { word, weight: Math.max(0.08, weight) };
  });

  const total = withWeight.reduce((sum, row) => sum + row.weight, 0);
  let target = Math.random() * total;

  for (const item of withWeight) {
    target -= item.weight;
    if (target <= 0) return item.word;
  }

  return withWeight[withWeight.length - 1].word;
}

export function generateQuestion(
  words: VocabWord[],
  mode: PracticeMode,
  progress: Record<string, WordProgress>,
  recentWords: string[] = []
): QuizQuestion {
  const candidates = chooseCandidateWords(mode, words, progress);
  const sourceWord = weightedWordChoice(candidates, progress, mode, recentWords);
  const coreMode = resolveCoreMode(mode, words, progress);

  if (coreMode === "definition_to_word") {
    return buildDefinitionToWordQuestion(sourceWord, words);
  }

  if (coreMode === "sentence_context") {
    const sentenceVariant = selectSentenceVariant(sourceWord.exampleSentence);
    const redactedSentence = stripWordFromSentence(sourceWord.word, sentenceVariant);
    if (!redactedSentence.replaced) {
      return buildDefinitionToWordQuestion(sourceWord, words);
    }

    const distractors = shuffled(
      words
        .filter((entry) => toComparable(entry.word) !== toComparable(sourceWord.word))
        .map((entry) => entry.word)
    ).slice(0, 3);
    const correctChoice = sourceWord.word;
    const choices = shuffled([correctChoice, ...distractors]);

    return {
      id: createQuestionId(),
      mode: coreMode,
      sourceWord,
      prompt: redactedSentence.prompt,
      choices,
      correctChoice,
      helperText: "Choose the best word for the sentence."
    };
  }

  const distractors = shuffled(
    words
      .filter((entry) => toComparable(entry.word) !== toComparable(sourceWord.word))
      .map((entry) => entry.definition)
  ).slice(0, 3);
  const correctChoice = sourceWord.definition;
  const choices = shuffled([correctChoice, ...distractors]);

  return {
    id: createQuestionId(),
    mode: "word_to_definition",
    sourceWord,
    prompt: sourceWord.word,
    choices,
    correctChoice,
    helperText: "Choose the best definition."
  };
}

export function updateWordProgress(
  current: WordProgress | undefined,
  vocabWord: VocabWord,
  isCorrect: boolean,
  responseMs: number
): WordProgress {
  const now = new Date().toISOString();
  const previous = current ?? {
    word: vocabWord.word,
    definition: vocabWord.definition,
    exampleSentence: vocabWord.exampleSentence,
    masteryScore: 0,
    attempts: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    averageResponseMs: 0,
    needsRetry: false,
    isWeak: false,
    missedCount: 0
  };

  const attempts = previous.attempts + 1;
  const correctAnswers = previous.correctAnswers + (isCorrect ? 1 : 0);
  const incorrectAnswers = previous.incorrectAnswers + (isCorrect ? 0 : 1);
  const averageResponseMs =
    attempts === 1
      ? responseMs
      : Math.round(
          (previous.averageResponseMs * previous.attempts + responseMs) / attempts
        );
  const accuracy = correctAnswers / attempts;
  const speedFactor = Math.min(1, 10000 / Math.max(1200, averageResponseMs));
  const masteryScore = Math.max(0, Math.min(1, accuracy * 0.82 + speedFactor * 0.18));
  const missedCount = previous.missedCount + (isCorrect ? 0 : 1);
  const isWeak = masteryScore < 0.6 || missedCount >= 3;

  return {
    word: vocabWord.word,
    definition: vocabWord.definition,
    exampleSentence: vocabWord.exampleSentence,
    masteryScore: Number(masteryScore.toFixed(4)),
    attempts,
    correctAnswers,
    incorrectAnswers,
    lastReviewed: now,
    averageResponseMs,
    lastResponseMs: responseMs,
    needsRetry: !isCorrect,
    isWeak,
    missedCount,
    lastResult: isCorrect ? "correct" : "incorrect",
    updatedAt: now
  };
}
