import {
  AchievementState,
  AppData,
  AppSettings,
  GlobalStats,
  ModeStats,
  QuestionType,
} from "../types";

export const DB_NAME = "sat-vocab-trainer-db";
export const DB_VERSION = 1;
export const KV_STORE = "app_kv";
export const APP_DATA_KEY = "study_data";
export const APP_SETTINGS_KEY = "settings";

export const MAX_EVENT_HISTORY_PER_WORD = 25;
export const MAX_SESSIONS = 200;

export const QUESTION_TYPES: QuestionType[] = [
  "word_to_definition_mc",
  "definition_to_word_mc",
  "sentence_context_mc",
];

const emptyModeStats = (): ModeStats => ({
  answered: 0,
  firstTryCorrect: 0,
  secondTryCorrect: 0,
  missed: 0,
  skipped: 0,
  totalResponseMs: 0,
});

export const defaultSettings: AppSettings = {
  timerMode: "untimed",
  questionTimeLimitSec: 20,
  sessionTimeLimitSec: 600,
  darkMode: false,
  defaultQuestionCount: 20,
  autoAdvanceOnCorrect: false,
};

const defaultGlobalStats: GlobalStats = {
  totalQuestionsAnswered: 0,
  totalSessions: 0,
  firstTryCorrect: 0,
  secondTryCorrect: 0,
  missed: 0,
  skipped: 0,
  currentStreak: 0,
  longestStreak: 0,
  averageResponseMs: 0,
  lastPracticedAt: undefined,
};

const achievementSeed = [
  ["streak_10", "10 in a Row", "Answer 10 questions correctly in a row.", 10],
  ["streak_25", "25 in a Row", "Answer 25 questions correctly in a row.", 25],
  ["streak_50", "50 in a Row", "Answer 50 questions correctly in a row.", 50],
  ["q_100", "100 Questions", "Answer 100 total questions.", 100],
  ["q_500", "500 Questions", "Answer 500 total questions.", 500],
  ["mastered_25", "Mastered 25", "Reach mastery on 25 words.", 25],
  ["mastered_100", "Mastered 100", "Reach mastery on 100 words.", 100],
  ["weak_session", "Weak Review", "Complete a weak-words review session.", 1],
  ["session_90", "High Accuracy", "Finish a session with at least 90% accuracy.", 1],
  ["sessions_7", "7 Sessions", "Complete 7 study sessions.", 7],
  ["streak_days_5", "5-Day Consistency", "Study on 5 consecutive days.", 5],
] as const;

export const createAchievementState = (): Record<string, AchievementState> => {
  return achievementSeed.reduce<Record<string, AchievementState>>((acc, item) => {
    const [id, title, description, target] = item;
    acc[id] = {
      id,
      title,
      description,
      target,
      progress: 0,
      unlockedAt: undefined,
    };
    return acc;
  }, {});
};

export const createEmptyAppData = (): AppData => ({
  version: 1,
  stats: { ...defaultGlobalStats },
  sessions: [],
  dailyHistory: {},
  modeStats: {
    word_to_definition_mc: emptyModeStats(),
    definition_to_word_mc: emptyModeStats(),
    sentence_context_mc: emptyModeStats(),
  },
  wordProgress: {},
  bookmarks: [],
  recentWordIds: [],
  achievements: createAchievementState(),
  lastSessionConfig: undefined,
  lastUpdatedAt: new Date().toISOString(),
});
