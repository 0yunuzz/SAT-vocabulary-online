"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn } from "next-auth/react";
import { ModeBadge } from "@/components/mode-badge";
import { QuestionCard } from "@/components/question-card";
import { StatGrid } from "@/components/stat-grid";
import { evaluateAchievements } from "@/lib/achievements";
import { normalizeSnapshot, updateStreak } from "@/lib/snapshot";
import type { PracticeMode, QuizQuestion } from "@/lib/types";
import { generateQuestion, updateWordProgress } from "@/utils/progress-engine";
import { useStudyData } from "@/utils/use-study-data";
import { useVocabWords } from "@/utils/use-vocab-words";

const PRACTICE_MODES: { value: PracticeMode; label: string }[] = [
  { value: "word_to_definition", label: "Word -> Definition" },
  { value: "definition_to_word", label: "Definition -> Word" },
  { value: "sentence_context", label: "Sentence Context" },
  { value: "mixed", label: "Mixed Practice" },
  { value: "weak_words", label: "Weak Words Mode" },
  { value: "missed_words", label: "Missed Words Mode" }
];

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function StudyPage() {
  const { words, loading: wordsLoading, error: wordsError } = useVocabWords();
  const {
    mode,
    setMode,
    syncStatus,
    snapshot,
    replaceSnapshot,
    upsertWordProgress,
    toggleBookmark,
    isSignedIn
  } = useStudyData();
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("mixed");
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [feedback, setFeedback] = useState<string>("");
  const [selectedChoice, setSelectedChoice] = useState<string | undefined>(undefined);
  const [isRetry, setIsRetry] = useState(false);
  const [questionStartedAt, setQuestionStartedAt] = useState<number>(() => Date.now());
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() => Date.now());
  const [sessionQuestions, setSessionQuestions] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);

  const totals = useMemo(() => {
    const values = Object.values(snapshot.wordProgress);
    const attempts = values.reduce((sum, item) => sum + item.attempts, 0);
    const correct = values.reduce((sum, item) => sum + item.correctAnswers, 0);
    const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    const weak = values.filter((item) => item.isWeak).length;
    const missed = values.filter((item) => item.missedCount > 0).length;
    return { attempts, accuracy, weak, missed };
  }, [snapshot.wordProgress]);

  const generateNextQuestion = () => {
    if (words.length === 0) return;
    const next = generateQuestion(words, practiceMode, snapshot.wordProgress);
    setQuestion(next);
    setSelectedChoice(undefined);
    setFeedback("");
    setIsRetry(false);
    setQuestionStartedAt(Date.now());
    setQuestionNumber((value) => value + 1);
  };

  const finalizeQuestion = (correct: boolean) => {
    setSessionQuestions((value) => value + 1);
    if (correct) setSessionCorrect((value) => value + 1);
    setTimeout(() => {
      generateNextQuestion();
    }, 450);
  };

  useEffect(() => {
    if (!question && words.length > 0 && !wordsLoading) {
      const first = generateQuestion(words, practiceMode, snapshot.wordProgress);
      setQuestion(first);
      setQuestionNumber(1);
      setQuestionStartedAt(Date.now());
    }
  }, [question, practiceMode, snapshot.wordProgress, words, wordsLoading]);

  const handlePracticeModeChange = (nextMode: PracticeMode) => {
    setPracticeMode(nextMode);
    if (words.length === 0) return;
    const nextQuestion = generateQuestion(words, nextMode, snapshot.wordProgress);
    setQuestion(nextQuestion);
    setQuestionNumber(1);
    setFeedback("");
    setIsRetry(false);
    setSelectedChoice(undefined);
    setQuestionStartedAt(Date.now());
  };

  const finishSession = () => {
    if (sessionQuestions === 0) {
      setFeedback("Answer at least one question to save a session.");
      return;
    }

    const endedAt = new Date();
    const startedAt = new Date(sessionStartedAt);
    const durationSec = Math.max(
      1,
      Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
    );
    const accuracy = sessionQuestions > 0 ? sessionCorrect / sessionQuestions : 0;
    const sessionRecord = {
      id: createId(),
      mode: practiceMode,
      totalQuestions: sessionQuestions,
      correctAnswers: sessionCorrect,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationSec,
      accuracy
    };

    const nextSnapshot = normalizeSnapshot({
      ...snapshot,
      sessions: [sessionRecord, ...snapshot.sessions].slice(0, 200),
      streak: updateStreak(snapshot.streak, endedAt),
      updatedAt: endedAt.toISOString()
    });
    nextSnapshot.achievements = evaluateAchievements(nextSnapshot, sessionRecord);

    replaceSnapshot(nextSnapshot);
    setSessionStartedAt(Date.now());
    setSessionQuestions(0);
    setSessionCorrect(0);
    setFeedback("Session saved.");
  };

  const onSelectChoice = (choice: string) => {
    if (!question) return;
    setSelectedChoice(choice);
    const responseMs = Math.max(250, Date.now() - questionStartedAt);
    const correct = choice === question.correctChoice;

    if (!correct && !isRetry) {
      const progress = updateWordProgress(
        snapshot.wordProgress[question.sourceWord.word],
        question.sourceWord,
        false,
        responseMs
      );
      upsertWordProgress(progress);
      setFeedback("Incorrect. Try once more before moving on.");
      setIsRetry(true);
      setQuestionStartedAt(Date.now());
      return;
    }

    const progress = updateWordProgress(
      snapshot.wordProgress[question.sourceWord.word],
      question.sourceWord,
      correct,
      responseMs
    );
    upsertWordProgress(progress);

    if (correct) {
      setFeedback("Correct.");
      finalizeQuestion(true);
    } else {
      setFeedback(`Incorrect. Correct answer: ${question.correctChoice}`);
      finalizeQuestion(false);
    }
  };

  if (mode === "account" && !isSignedIn) {
    return (
      <section className="panel">
        <h2>Sign in required for account mode</h2>
        <p className="muted">
          You selected signed-in mode, but no active Google session was found.
        </p>
        <div className="buttonRow">
          <button
            type="button"
            className="button"
            onClick={() => void signIn("google", { callbackUrl: "/study" })}
          >
            Sign in with Google
          </button>
          <button type="button" className="button secondary" onClick={() => setMode("guest")}>
            Switch to Guest Mode
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="panel splitColumns">
        <div>
          <h2>Practice Session</h2>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
          <p className="muted">
            Guest mode stores progress locally. Signed-in mode syncs with the
            database across devices.
          </p>
        </div>
        <div>
          <label htmlFor="mode" className="eyebrow">
            Study Mode
          </label>
          <select
            id="mode"
            value={practiceMode}
            onChange={(event) =>
              handlePracticeModeChange(event.target.value as PracticeMode)
            }
          >
            {PRACTICE_MODES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <div className="buttonRow" style={{ marginTop: "0.8rem" }}>
            <button className="button secondary" type="button" onClick={finishSession}>
              End Session
            </button>
            {question ? (
              <button
                className="button secondary"
                type="button"
                onClick={() => toggleBookmark(question.sourceWord.word)}
              >
                {snapshot.bookmarks.includes(question.sourceWord.word)
                  ? "Remove Bookmark"
                  : "Bookmark Word"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "Total Attempts", value: totals.attempts },
          { label: "Accuracy", value: `${totals.accuracy}%` },
          { label: "Weak Words", value: totals.weak },
          { label: "Missed Words", value: totals.missed }
        ]}
      />

      {wordsLoading ? (
        <section className="panel">
          <p>Loading SAT vocabulary list...</p>
        </section>
      ) : null}

      {wordsError ? (
        <section className="panel">
          <p>{wordsError}</p>
        </section>
      ) : null}

      {question && !wordsLoading ? (
        <QuestionCard
          question={question}
          questionNumber={questionNumber}
          selectedChoice={selectedChoice}
          feedback={feedback}
          isRetry={isRetry}
          onSelect={onSelectChoice}
        />
      ) : null}
    </>
  );
}
