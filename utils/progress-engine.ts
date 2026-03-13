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
  return [...list].sort(() => Math.random() - 0.5);
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

function stripWordFromSentence(word: string, sentence: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  if (!regex.test(sentence)) return sentence;
  return sentence.replace(regex, "_____");
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
    return weakWords.length > 0 ? weakWords : words;
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
  progress: Record<string, WordProgress>
): VocabWord {
  const withWeight = words.map((word) => {
    const state = progress[word.word];
    if (!state) {
      return { word, weight: 2 };
    }
    const weaknessBoost = (1 - state.masteryScore) * 4;
    const missedBoost = state.missedCount * 1.5;
    const retryBoost = state.needsRetry ? 3 : 0;
    return {
      word,
      weight: Math.max(1, weaknessBoost + missedBoost + retryBoost + 1)
    };
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
  progress: Record<string, WordProgress>
): QuizQuestion {
  const candidates = chooseCandidateWords(mode, words, progress);
  const sourceWord = weightedWordChoice(candidates, progress);
  const coreMode = resolveCoreMode(mode, words, progress);

  if (coreMode === "definition_to_word") {
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
      prompt: sourceWord.definition,
      choices,
      correctChoice,
      helperText: "Choose the matching SAT word."
    };
  }

  if (coreMode === "sentence_context") {
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
      prompt: stripWordFromSentence(sourceWord.word, sourceWord.exampleSentence),
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
