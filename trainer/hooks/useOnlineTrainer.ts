"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEmptySnapshot } from "@/lib/snapshot";
import { useStudyData } from "@/utils/use-study-data";
import { buildSessionQuestions } from "../domain/session";
import { createEmptyAppData, defaultSettings } from "../domain/constants";
import { loadVocabulary } from "../domain/vocabLoader";
import { commitSessionResults } from "../domain/stats";
import { fromSyncSnapshot, toSyncSnapshot } from "../domain/snapshotBridge";
import type {
  ActiveSession,
  AppData,
  AppScreen,
  AppSettings,
  AttemptOutcome,
  PracticeQuestion,
  SessionConfig,
  SessionQuestionResult,
  SessionSummary,
  VocabLoadWarning,
  VocabWord
} from "../types";

interface TrainerState {
  initialized: boolean;
  loading: boolean;
  loadWarnings: VocabLoadWarning[];
  error?: string;
  vocabWords: VocabWord[];
  appData: AppData;
  settings: AppSettings;
  screen: AppScreen;
  activeSession?: ActiveSession;
  lastSummary?: SessionSummary;
  transientNotice?: string;
}

const SETTINGS_KEY = "sat_vocab_online_trainer_settings";

const initialState: TrainerState = {
  initialized: false,
  loading: true,
  loadWarnings: [],
  error: undefined,
  vocabWords: [],
  appData: createEmptyAppData(),
  settings: defaultSettings,
  screen: "dashboard",
  activeSession: undefined,
  lastSummary: undefined,
  transientNotice: undefined
};

const buildDataKey = (mode: "guest" | "account", userId?: string): string =>
  mode === "account" && userId
    ? `sat_vocab_online_trainer_data_account_${userId}`
    : "sat_vocab_online_trainer_data_guest";

const loadStoredSettings = (): AppSettings => {
  if (typeof window === "undefined") return defaultSettings;
  const raw = window.localStorage.getItem(SETTINGS_KEY);
  if (!raw) return defaultSettings;
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

const loadStoredAppData = (key: string): AppData | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AppData;
  } catch {
    return null;
  }
};

const saveStoredSettings = (settings: AppSettings): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

const saveStoredAppData = (key: string, appData: AppData): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(appData));
};

const pickLatestAppData = (seed: AppData, stored: AppData | null): AppData => {
  if (!stored) return seed;
  return +new Date(stored.lastUpdatedAt) >= +new Date(seed.lastUpdatedAt) ? stored : seed;
};

const isCorrectAnswer = (question: PracticeQuestion, choiceId: string | undefined): boolean =>
  Boolean(choiceId && question.answerChoiceId === choiceId);

const createSessionResult = (
  question: PracticeQuestion,
  outcome: AttemptOutcome,
  attempts: number,
  responseMs: number
): SessionQuestionResult => ({
  questionId: question.id,
  wordId: question.wordId,
  questionType: question.type,
  mode: question.sourceMode,
  outcome,
  responseMs,
  attempts
});

const sessionFromConfig = (
  config: SessionConfig,
  questions: PracticeQuestion[]
): ActiveSession => {
  const startedAt = new Date().toISOString();
  const now = Date.now();

  return {
    id: `session_${now}`,
    config,
    questions,
    startedAt,
    currentIndex: 0,
    currentAttempt: 1,
    questionStartedAt: now,
    sessionRemainingSec:
      config.timerMode === "session" ? config.sessionTimeLimitSec : undefined,
    questionRemainingSec:
      config.timerMode === "question" ? config.questionTimeLimitSec : undefined,
    selectedChoiceId: undefined,
    completedResults: [],
    feedback: undefined
  };
};

const withQuestionDefaults = (session: ActiveSession): ActiveSession => ({
  ...session,
  currentAttempt: 1,
  selectedChoiceId: undefined,
  feedback: undefined,
  questionStartedAt: Date.now(),
  questionRemainingSec:
    session.config.timerMode === "question"
      ? session.config.questionTimeLimitSec
      : undefined
});

export const useOnlineTrainer = (initialScreen: AppScreen = "dashboard") => {
  const study = useStudyData();
  const [state, setState] = useState<TrainerState>(initialState);
  const syncTimeoutRef = useRef<number | undefined>(undefined);
  const hydratedKeyRef = useRef<string | null>(null);
  const activeDataKey = useMemo(
    () => buildDataKey(study.mode, study.user?.id),
    [study.mode, study.user?.id]
  );

  const wordsById = useMemo(
    () => new Map(state.vocabWords.map((word) => [word.id, word])),
    [state.vocabWords]
  );

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const vocab = await loadVocabulary();
        if (cancelled) return;

        setState((prev) => ({
          ...prev,
          loading: false,
          vocabWords: vocab.words,
          loadWarnings: vocab.warnings,
          error: vocab.words.length
            ? undefined
            : "Vocabulary data could not be loaded. Check public/data/sat_vocab.csv.",
          screen: initialScreen
        }));
      } catch {
        if (cancelled) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "App initialization failed. Please refresh and verify vocabulary file format."
        }));
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [initialScreen]);

  useEffect(() => {
    if (state.loading || !study.ready || !state.vocabWords.length) return;
    if (hydratedKeyRef.current === activeDataKey) return;

    const snapshotSeed = fromSyncSnapshot(study.snapshot, state.vocabWords);
    const stored = loadStoredAppData(activeDataKey);
    const appData = pickLatestAppData(snapshotSeed, stored);

    setState((prev) => ({
      ...prev,
      initialized: true,
      appData,
      settings: loadStoredSettings(),
      screen: initialScreen,
      activeSession: undefined,
      lastSummary: undefined
    }));

    hydratedKeyRef.current = activeDataKey;
  }, [
    activeDataKey,
    initialScreen,
    state.loading,
    state.vocabWords,
    study.ready,
    study.snapshot
  ]);

  useEffect(() => {
    if (!state.initialized) return;

    saveStoredSettings(state.settings);
    saveStoredAppData(activeDataKey, state.appData);

    window.clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = window.setTimeout(() => {
      const syncSnapshot = toSyncSnapshot(state.appData, wordsById);
      study.replaceSnapshot(syncSnapshot);
    }, 300);

    return () => window.clearTimeout(syncTimeoutRef.current);
  }, [
    activeDataKey,
    state.appData,
    state.initialized,
    state.settings,
    study.replaceSnapshot,
    wordsById
  ]);

  const navigate = useCallback((screen: AppScreen) => {
    setState((prev) => ({ ...prev, screen, transientNotice: undefined }));
  }, []);

  const startSession = useCallback((config: SessionConfig) => {
    setState((prev) => {
      const normalizedConfig: SessionConfig = {
        ...config,
        questionTimeLimitSec:
          config.questionTimeLimitSec ?? prev.settings.questionTimeLimitSec,
        sessionTimeLimitSec:
          config.sessionTimeLimitSec ?? prev.settings.sessionTimeLimitSec
      };

      const questions = buildSessionQuestions(
        prev.vocabWords,
        prev.appData,
        normalizedConfig
      );
      if (!questions.length) {
        return {
          ...prev,
          transientNotice:
            "No eligible words match this setup. Try a broader mode or clear one of the filters."
        };
      }

      return {
        ...prev,
        appData: {
          ...prev.appData,
          lastSessionConfig: normalizedConfig,
          lastUpdatedAt: new Date().toISOString()
        },
        activeSession: sessionFromConfig(normalizedConfig, questions),
        screen: "practice",
        transientNotice: undefined
      };
    });
  }, []);

  const selectChoice = useCallback((choiceId: string) => {
    setState((prev) => {
      if (!prev.activeSession) return prev;
      if (prev.activeSession.feedback && prev.activeSession.feedback.status !== "retry") {
        return prev;
      }
      return {
        ...prev,
        activeSession: {
          ...prev.activeSession,
          selectedChoiceId: choiceId
        }
      };
    });
  }, []);

  const finalizeSessionState = useCallback(
    (baseState: TrainerState, session: ActiveSession): TrainerState => {
      if (!session.completedResults.length) {
        return {
          ...baseState,
          activeSession: undefined,
          screen: "dashboard",
          transientNotice: "Session ended with no recorded answers."
        };
      }

      const commit = commitSessionResults(baseState.appData, wordsById, {
        sessionId: session.id,
        mode: session.config.mode,
        timerMode: session.config.timerMode,
        startedAt: session.startedAt,
        endedAt: new Date().toISOString(),
        results: session.completedResults
      });

      return {
        ...baseState,
        appData: commit.updated,
        activeSession: undefined,
        lastSummary: commit.summary,
        screen: "results",
        transientNotice: undefined
      };
    },
    [wordsById]
  );

  const moveToNextQuestion = useCallback(() => {
    setState((prev) => {
      const session = prev.activeSession;
      if (!session) return prev;

      if (session.currentIndex >= session.questions.length - 1) {
        return finalizeSessionState(prev, session);
      }

      return {
        ...prev,
        activeSession: withQuestionDefaults({
          ...session,
          currentIndex: session.currentIndex + 1
        })
      };
    });
  }, [finalizeSessionState]);

  const recordOutcome = useCallback(
    (
      prev: TrainerState,
      outcome: AttemptOutcome,
      feedback: ActiveSession["feedback"],
      forceEnd = false
    ): TrainerState => {
      const session = prev.activeSession;
      if (!session) return prev;

      const question = session.questions[session.currentIndex];
      if (!question) return prev;

      const responseMs = Math.max(250, Date.now() - session.questionStartedAt);
      const result = createSessionResult(
        question,
        outcome,
        session.currentAttempt,
        responseMs
      );

      const updatedSession: ActiveSession = {
        ...session,
        completedResults: [...session.completedResults, result],
        feedback
      };

      if (forceEnd) {
        return finalizeSessionState(prev, updatedSession);
      }

      return {
        ...prev,
        activeSession: updatedSession
      };
    },
    [finalizeSessionState]
  );

  const submitAnswer = useCallback(() => {
    setState((prev) => {
      const session = prev.activeSession;
      if (!session) return prev;
      if (session.feedback && session.feedback.status !== "retry") return prev;

      const question = session.questions[session.currentIndex];
      if (!question) return prev;

      const correct = isCorrectAnswer(question, session.selectedChoiceId);
      if (correct) {
        const outcome: AttemptOutcome =
          session.currentAttempt === 1 ? "first_try" : "second_try";
        return recordOutcome(prev, outcome, {
          status: "correct",
          message:
            outcome === "first_try"
              ? "Correct on the first try."
              : "Correct on the second try. Nice recovery."
        });
      }

      if (session.currentAttempt === 1) {
        return {
          ...prev,
          activeSession: {
            ...session,
            currentAttempt: 2,
            selectedChoiceId: undefined,
            feedback: {
              status: "retry",
              message: "Not quite. Take one more attempt before reveal."
            }
          }
        };
      }

      return recordOutcome(prev, "missed", {
        status: "revealed",
        message: "Second attempt missed. Review the correct answer below."
      });
    });
  }, [recordOutcome]);

  const skipQuestion = useCallback(
    (fromTimeout = false) => {
      setState((prev) => {
        const notice = fromTimeout ? "Time expired. Question skipped." : "Question skipped.";
        return recordOutcome(prev, "skipped", {
          status: "skipped",
          message: notice
        });
      });
    },
    [recordOutcome]
  );

  const endSessionNow = useCallback(() => {
    setState((prev) => {
      const session = prev.activeSession;
      if (!session) return prev;
      return finalizeSessionState(prev, session);
    });
  }, [finalizeSessionState]);

  const retryLastSession = useCallback(() => {
    setState((prev) => {
      const config = prev.appData.lastSessionConfig;
      if (!config) {
        return { ...prev, transientNotice: "No previous session setup found yet." };
      }

      const questions = buildSessionQuestions(prev.vocabWords, prev.appData, config);
      if (!questions.length) {
        return {
          ...prev,
          transientNotice: "Could not rebuild that session with current progress and filters."
        };
      }

      return {
        ...prev,
        activeSession: sessionFromConfig(config, questions),
        screen: "practice",
        transientNotice: undefined
      };
    });
  }, []);

  const toggleBookmark = useCallback((wordId: string) => {
    setState((prev) => {
      const bookmarks = new Set(prev.appData.bookmarks);
      if (bookmarks.has(wordId)) bookmarks.delete(wordId);
      else bookmarks.add(wordId);

      return {
        ...prev,
        appData: {
          ...prev.appData,
          bookmarks: [...bookmarks],
          lastUpdatedAt: new Date().toISOString()
        }
      };
    });
  }, []);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...patch
      }
    }));
  }, []);

  const clearNotice = useCallback(() => {
    setState((prev) => ({ ...prev, transientNotice: undefined }));
  }, []);

  const resetProgress = useCallback(async () => {
    const resetData = createEmptyAppData();
    saveStoredAppData(activeDataKey, resetData);
    study.replaceSnapshot(createEmptySnapshot());
    setState((prev) => ({
      ...prev,
      appData: resetData,
      screen: "dashboard",
      lastSummary: undefined,
      activeSession: undefined,
      transientNotice: "All study data for the current mode was cleared."
    }));
  }, [activeDataKey, study.replaceSnapshot]);

  useEffect(() => {
    const session = state.activeSession;
    if (!session) return;
    if (session.feedback && session.feedback.status !== "retry") return;
    if (session.config.timerMode === "untimed") return;

    const timer = window.setInterval(() => {
      setState((prev) => {
        if (!prev.activeSession) return prev;

        const current = prev.activeSession;
        let questionRemainingSec = current.questionRemainingSec;
        let sessionRemainingSec = current.sessionRemainingSec;

        if (current.config.timerMode === "question" && questionRemainingSec !== undefined) {
          questionRemainingSec = Math.max(0, questionRemainingSec - 1);
        }

        if (current.config.timerMode === "session" && sessionRemainingSec !== undefined) {
          sessionRemainingSec = Math.max(0, sessionRemainingSec - 1);
        }

        return {
          ...prev,
          activeSession: {
            ...current,
            questionRemainingSec,
            sessionRemainingSec
          }
        };
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [
    state.activeSession?.id,
    state.activeSession?.currentIndex,
    state.activeSession?.feedback,
    state.activeSession?.config.timerMode
  ]);

  useEffect(() => {
    const session = state.activeSession;
    if (!session) return;
    if (session.feedback && session.feedback.status !== "retry") return;

    if (session.config.timerMode === "question" && session.questionRemainingSec === 0) {
      skipQuestion(true);
      return;
    }

    if (session.config.timerMode === "session" && session.sessionRemainingSec === 0) {
      setState((prev) =>
        recordOutcome(
          prev,
          "skipped",
          {
            status: "skipped",
            message: "Session timer ended. Current question was marked skipped."
          },
          true
        )
      );
    }
  }, [
    state.activeSession?.questionRemainingSec,
    state.activeSession?.sessionRemainingSec,
    state.activeSession?.feedback,
    state.activeSession?.config.timerMode,
    skipQuestion,
    recordOutcome
  ]);

  useEffect(() => {
    const session = state.activeSession;
    if (!session || !state.settings.autoAdvanceOnCorrect) return;
    if (session.feedback?.status !== "correct") return;

    const id = window.setTimeout(() => {
      moveToNextQuestion();
    }, 650);

    return () => window.clearTimeout(id);
  }, [
    state.activeSession?.feedback?.status,
    state.settings.autoAdvanceOnCorrect,
    moveToNextQuestion
  ]);

  return {
    state,
    wordsById,
    modeState: {
      mode: study.mode,
      syncStatus: study.syncStatus,
      isSignedIn: study.isSignedIn,
      user: study.user
    },
    actions: {
      navigate,
      startSession,
      selectChoice,
      submitAnswer,
      moveToNextQuestion,
      skipQuestion,
      endSessionNow,
      retryLastSession,
      toggleBookmark,
      updateSettings,
      clearNotice,
      resetProgress
    }
  };
};
