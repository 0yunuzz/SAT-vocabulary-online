export type AppScreen =
  | "dashboard"
  | "setup"
  | "practice"
  | "results"
  | "review"
  | "library"
  | "settings"
  | "achievements";

export type PracticeMode =
  | "word_to_definition"
  | "definition_to_word"
  | "sentence_context"
  | "mixed"
  | "missed_words"
  | "weak_words"
  | "bookmarked_words"
  | "recent_words"
  | "custom";

export type CustomWordBucket =
  | "all"
  | "weak"
  | "missed"
  | "bookmarked"
  | "recent"
  | "unmastered";

export type TimerMode = "untimed" | "question" | "session";

export type QuestionType =
  | "word_to_definition_mc"
  | "definition_to_word_mc"
  | "sentence_context_mc";

export type AttemptOutcome = "first_try" | "second_try" | "missed" | "skipped";

export interface VocabWord {
  id: string;
  word: string;
  definition: string;
  exampleSentence: string;
  partOfSpeech?: string;
  synonyms: string[];
  difficulty?: number;
  sourceGroup?: string;
  notes?: string;
  normalizedWord: string;
  normalizedDefinition: string;
  firstLetter: string;
}

export interface VocabLoadWarning {
  row: number;
  message: string;
}

export interface VocabLoadResult {
  words: VocabWord[];
  warnings: VocabLoadWarning[];
  source: "csv" | "json";
}

export interface WordEvent {
  at: string;
  mode: PracticeMode;
  questionType: QuestionType;
  outcome: AttemptOutcome;
  responseMs: number;
}

export interface WordProgress {
  wordId: string;
  timesSeen: number;
  firstTryCorrect: number;
  secondTryCorrect: number;
  missed: number;
  skipped: number;
  totalResponseMs: number;
  recentEvents: WordEvent[];
  masteryScore: number;
  successfulRecallStreak: number;
  secondTryReliance: number;
  lastSeenAt?: string;
  nextDueAt?: string;
}

export interface SessionQuestionResult {
  questionId: string;
  wordId: string;
  questionType: QuestionType;
  mode: PracticeMode;
  outcome: AttemptOutcome;
  responseMs: number;
  attempts: number;
}

export interface SessionRecord {
  id: string;
  startedAt: string;
  endedAt: string;
  mode: PracticeMode;
  timerMode: TimerMode;
  questionCount: number;
  firstTryCorrect: number;
  secondTryCorrect: number;
  missed: number;
  skipped: number;
  averageResponseMs: number;
  accuracy: number;
  wordIds: string[];
  difficultWordIds: string[];
  strongestWordIds: string[];
  results: SessionQuestionResult[];
}

export interface DailyStudyStat {
  date: string;
  questions: number;
  sessions: number;
  firstTryCorrect: number;
  secondTryCorrect: number;
  missed: number;
}

export interface ModeStats {
  answered: number;
  firstTryCorrect: number;
  secondTryCorrect: number;
  missed: number;
  skipped: number;
  totalResponseMs: number;
}

export interface AchievementState {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  unlockedAt?: string;
}

export interface GlobalStats {
  totalQuestionsAnswered: number;
  totalSessions: number;
  firstTryCorrect: number;
  secondTryCorrect: number;
  missed: number;
  skipped: number;
  currentStreak: number;
  longestStreak: number;
  averageResponseMs: number;
  lastPracticedAt?: string;
}

export interface AppSettings {
  timerMode: TimerMode;
  questionTimeLimitSec: number;
  sessionTimeLimitSec: number;
  darkMode: boolean;
  defaultQuestionCount: number;
  autoAdvanceOnCorrect: boolean;
}

export interface AppData {
  version: number;
  stats: GlobalStats;
  sessions: SessionRecord[];
  dailyHistory: Record<string, DailyStudyStat>;
  modeStats: Record<QuestionType, ModeStats>;
  wordProgress: Record<string, WordProgress>;
  bookmarks: string[];
  recentWordIds: string[];
  achievements: Record<string, AchievementState>;
  lastSessionConfig?: SessionConfig;
  lastUpdatedAt: string;
}

export interface SessionConfig {
  mode: PracticeMode;
  questionCount: number;
  timerMode: TimerMode;
  customBucket: CustomWordBucket;
  manualRangeStart?: number;
  manualRangeEnd?: number;
  firstLetterFilter?: string;
  sourceGroupFilter?: string;
  customQuestionTypes: QuestionType[];
  questionTimeLimitSec: number;
  sessionTimeLimitSec: number;
}

export interface QuestionChoice {
  id: string;
  label: string;
}

export interface PracticeQuestion {
  id: string;
  type: QuestionType;
  sourceMode: PracticeMode;
  wordId: string;
  prompt: string;
  subPrompt?: string;
  choices: QuestionChoice[];
  answerChoiceId: string;
  answerText: string;
  sentenceWithBlank?: string;
}

export interface ActiveSession {
  id: string;
  config: SessionConfig;
  questions: PracticeQuestion[];
  startedAt: string;
  currentIndex: number;
  currentAttempt: 1 | 2;
  questionStartedAt: number;
  sessionRemainingSec?: number;
  questionRemainingSec?: number;
  selectedChoiceId?: string;
  completedResults: SessionQuestionResult[];
  feedback?: {
    status: "correct" | "retry" | "revealed" | "skipped";
    message: string;
  };
}

export interface SessionSummary {
  session: SessionRecord;
  struggledWords: string[];
  strongWords: string[];
  recommendedAction: string;
}
