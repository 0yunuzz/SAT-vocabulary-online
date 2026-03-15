import { selectAdaptiveWords } from "./adaptive";
import { pickDistractors } from "./distractors";
import { AppData, PracticeMode, PracticeQuestion, QuestionChoice, QuestionType, SessionConfig, VocabWord } from "../types";
import { normalizeAnswer, shuffle } from "../utils/text";
import { wordStatus } from "./mastery";

const questionTypeLabels: Record<QuestionType, string> = {
  word_to_definition_mc: "Word to Definition",
  definition_to_word_mc: "Definition to Word",
  sentence_context_mc: "Sentence Context",
};

export const getQuestionTypeLabel = (type: QuestionType): string => questionTypeLabels[type];

export const modeLabels: Record<PracticeMode, string> = {
  word_to_definition: "Word -> Definition",
  definition_to_word: "Definition -> Word",
  sentence_context: "Sentence Context",
  mixed: "Mixed Mode",
  missed_words: "Missed Words",
  weak_words: "Weak Words",
  bookmarked_words: "Bookmarked Words",
  recent_words: "Recent Words",
  custom: "Custom Study",
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pickSentenceVariant = (sentence: string): string => {
  const variants = sentence
    .split("|")
    .map((part) => part.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);
  if (!variants.length) return sentence;
  return variants[Math.floor(Math.random() * variants.length)] ?? sentence;
};

const buildWordForms = (word: string): string[] => {
  const parts = word
    .toLowerCase()
    .split(/\s*(?:\/|,|;|\bor\b|\|)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const forms = new Set<string>();
  for (const base of parts) {
    forms.add(base);
    if (!/^[a-z]+$/.test(base)) continue;

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

    if (/(s|x|z|ch|sh)$/.test(base)) forms.add(`${base}es`);
    else forms.add(`${base}s`);
  }

  return Array.from(forms).sort((a, b) => b.length - a.length);
};

const sentenceWithBlank = (sentence: string, word: string): string => {
  const selectedSentence = pickSentenceVariant(sentence);
  const forms = buildWordForms(word);
  let output = selectedSentence;
  let replacements = 0;

  for (const form of forms) {
    const regex = new RegExp(`\\b${escapeRegExp(form)}\\b`, "gi");
    const matches = output.match(regex);
    if (!matches) continue;
    replacements += matches.length;
    output = output.replace(regex, "_____ ");
  }

  if (replacements === 0) {
    const lowerWord = word.trim().toLowerCase();
    if (/^[a-z]{4,}$/.test(lowerWord)) {
      const stem = lowerWord.endsWith("e") ? lowerWord.slice(0, -1) : lowerWord;
      const regex = new RegExp(`\\b${escapeRegExp(stem)}[a-z]*\\b`, "gi");
      const matches = output.match(regex);
      if (matches) {
        replacements += matches.length;
        output = output.replace(regex, "_____ ");
      }
    }
  }

  if (replacements > 0) return output;
  return `${selectedSentence} (Target word removed: _____)`;
};

const toChoice = (label: string, index: number): QuestionChoice => ({
  id: `choice_${index}_${Math.random().toString(36).slice(2, 7)}`,
  label,
});

const buildWordToDefinition = (
  target: VocabWord,
  allWords: VocabWord[],
  sourceMode: PracticeMode,
  index: number
): PracticeQuestion => {
  const distractors = pickDistractors(target, allWords, 3);
  const options = shuffle([target, ...distractors]).map((word, optionIndex) =>
    toChoice(word.definition, optionIndex)
  );

  const correctChoice = options.find((choice) => normalizeAnswer(choice.label) === target.normalizedDefinition);

  return {
    id: `q_${index}_${target.id}`,
    type: "word_to_definition_mc",
    sourceMode,
    wordId: target.id,
    prompt: target.word,
    subPrompt: "Select the best definition.",
    choices: options,
    answerChoiceId: correctChoice?.id ?? options[0].id,
    answerText: target.definition,
  };
};

const buildDefinitionToWord = (
  target: VocabWord,
  allWords: VocabWord[],
  sourceMode: PracticeMode,
  index: number
): PracticeQuestion => {
  const distractors = pickDistractors(target, allWords, 3);
  const options = shuffle([target, ...distractors]).map((word, optionIndex) =>
    toChoice(word.word, optionIndex)
  );

  const correctChoice = options.find((choice) => normalizeAnswer(choice.label) === target.normalizedWord);

  return {
    id: `q_${index}_${target.id}`,
    type: "definition_to_word_mc",
    sourceMode,
    wordId: target.id,
    prompt: target.definition,
    subPrompt: "Choose the SAT word that matches the definition.",
    choices: options,
    answerChoiceId: correctChoice?.id ?? options[0].id,
    answerText: target.word,
  };
};

const buildSentenceMultipleChoice = (
  target: VocabWord,
  allWords: VocabWord[],
  sourceMode: PracticeMode,
  index: number
): PracticeQuestion => {
  const distractors = pickDistractors(target, allWords, 3);
  const options = shuffle([target, ...distractors]).map((word, optionIndex) =>
    toChoice(word.word, optionIndex)
  );
  const correctChoice = options.find((choice) => normalizeAnswer(choice.label) === target.normalizedWord);

  return {
    id: `q_${index}_${target.id}`,
    type: "sentence_context_mc",
    sourceMode,
    wordId: target.id,
    prompt: sentenceWithBlank(target.exampleSentence, target.word),
    subPrompt: "Pick the word that best fits the sentence context.",
    choices: options,
    answerChoiceId: correctChoice?.id ?? options[0].id,
    answerText: target.word,
    sentenceWithBlank: sentenceWithBlank(target.exampleSentence, target.word),
  };
};

const getTypeForMode = (mode: PracticeMode, index: number, customTypes: QuestionType[]): QuestionType => {
  if (mode === "word_to_definition") return "word_to_definition_mc";
  if (mode === "definition_to_word") return "definition_to_word_mc";
  if (mode === "sentence_context") return "sentence_context_mc";

  if (mode === "custom" && customTypes.length) {
    return customTypes[index % customTypes.length];
  }

  const mixed: QuestionType[] = [
    "word_to_definition_mc",
    "definition_to_word_mc",
    "sentence_context_mc",
  ];

  return mixed[index % mixed.length];
};

const buildQuestionByType = (
  type: QuestionType,
  target: VocabWord,
  allWords: VocabWord[],
  sourceMode: PracticeMode,
  index: number
): PracticeQuestion => {
  switch (type) {
    case "word_to_definition_mc":
      return buildWordToDefinition(target, allWords, sourceMode, index);
    case "definition_to_word_mc":
      return buildDefinitionToWord(target, allWords, sourceMode, index);
    case "sentence_context_mc":
    default:
      return buildSentenceMultipleChoice(target, allWords, sourceMode, index);
  }
};

const sortByRecent = (words: VocabWord[], data: AppData): VocabWord[] => {
  return [...words].sort((a, b) => {
    const aSeen = data.wordProgress[a.id]?.lastSeenAt;
    const bSeen = data.wordProgress[b.id]?.lastSeenAt;
    if (!aSeen && !bSeen) return 0;
    if (!aSeen) return 1;
    if (!bSeen) return -1;
    return new Date(bSeen).getTime() - new Date(aSeen).getTime();
  });
};

const filterByConfig = (words: VocabWord[], config: SessionConfig): VocabWord[] => {
  let filtered = [...words];

  if (config.firstLetterFilter) {
    filtered = filtered.filter((word) => word.firstLetter === config.firstLetterFilter);
  }

  if (config.sourceGroupFilter) {
    filtered = filtered.filter((word) => word.sourceGroup === config.sourceGroupFilter);
  }

  if (config.manualRangeStart !== undefined || config.manualRangeEnd !== undefined) {
    const start = Math.max(1, config.manualRangeStart ?? 1);
    const end = Math.min(filtered.length, config.manualRangeEnd ?? filtered.length);
    filtered = filtered.slice(start - 1, end);
  }

  return filtered;
};

export const getCandidateWords = (
  allWords: VocabWord[],
  data: AppData,
  config: SessionConfig
): VocabWord[] => {
  const bookmarks = new Set(data.bookmarks);
  const recentSet = new Set(data.recentWordIds);

  let candidates = filterByConfig(allWords, config);

  if (config.mode === "missed_words") {
    candidates = candidates.filter((word) => (data.wordProgress[word.id]?.missed ?? 0) > 0);
  } else if (config.mode === "weak_words") {
    candidates = candidates.filter((word) => wordStatus(data.wordProgress[word.id]) === "weak");
  } else if (config.mode === "bookmarked_words") {
    candidates = candidates.filter((word) => bookmarks.has(word.id));
  } else if (config.mode === "recent_words") {
    candidates = sortByRecent(candidates.filter((word) => recentSet.has(word.id)), data);
  } else if (config.mode === "custom") {
    if (config.customBucket === "weak") {
      candidates = candidates.filter((word) => wordStatus(data.wordProgress[word.id]) === "weak");
    } else if (config.customBucket === "missed") {
      candidates = candidates.filter((word) => (data.wordProgress[word.id]?.missed ?? 0) > 0);
    } else if (config.customBucket === "bookmarked") {
      candidates = candidates.filter((word) => bookmarks.has(word.id));
    } else if (config.customBucket === "recent") {
      candidates = sortByRecent(candidates.filter((word) => recentSet.has(word.id)), data);
    } else if (config.customBucket === "unmastered") {
      candidates = candidates.filter((word) => wordStatus(data.wordProgress[word.id]) !== "mastered");
    }
  }

  return candidates;
};

export const buildSessionQuestions = (
  allWords: VocabWord[],
  data: AppData,
  config: SessionConfig
): PracticeQuestion[] => {
  const candidates = getCandidateWords(allWords, data, config);
  const desiredCount = Math.max(1, config.questionCount);

  const selectedWords = selectAdaptiveWords(candidates, data, Math.min(desiredCount, candidates.length));

  return selectedWords.map((word, index) => {
    const type = getTypeForMode(config.mode, index, config.customQuestionTypes);
    return buildQuestionByType(type, word, allWords, config.mode, index);
  });
};
