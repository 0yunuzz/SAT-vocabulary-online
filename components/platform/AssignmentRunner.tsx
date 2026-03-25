"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type QuestionFormat = "MULTIPLE_CHOICE" | "TYPED_RESPONSE";

interface RunnerQuestion {
  id: string;
  position: number;
  prompt: string;
  subPrompt: string | null;
  format: QuestionFormat;
  choices: string[];
}

interface RunnerResponse {
  questionId: string;
  attempts: number;
  completed: boolean;
  isCorrect: boolean | null;
  firstCorrect: boolean | null;
}

interface AssignmentRunnerProps {
  assignmentId: string;
  title: string;
  dueAtIso: string;
  allowLateSubmissions: boolean;
  started: boolean;
  submittedAtIso?: string | null;
  submissionKind?: string | null;
  questions: RunnerQuestion[];
  responses: RunnerResponse[];
  canStart: boolean;
}

export function AssignmentRunner({
  assignmentId,
  title,
  dueAtIso,
  allowLateSubmissions,
  started,
  submittedAtIso,
  submissionKind,
  questions,
  responses,
  canStart
}: AssignmentRunnerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localSubmittedAt, setLocalSubmittedAt] = useState<string | null>(
    submittedAtIso ?? null
  );
  const [localStarted, setLocalStarted] = useState(started);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [revealAnswers, setRevealAnswers] = useState<Record<string, string>>({});
  const [responseState, setResponseState] = useState<Record<string, RunnerResponse>>(
    () =>
      Object.fromEntries(responses.map((response) => [response.questionId, response]))
  );

  const firstOpenIndex = useMemo(() => {
    const pending = questions.findIndex((question) => {
      const response = responseState[question.id];
      return !response || !response.completed;
    });
    return pending >= 0 ? pending : questions.length - 1;
  }, [questions, responseState]);

  const [currentIndex, setCurrentIndex] = useState(Math.max(firstOpenIndex, 0));
  const questionStartRef = useRef<number>(Date.now());

  const currentQuestion = questions[currentIndex];
  const currentResponse = currentQuestion ? responseState[currentQuestion.id] : undefined;
  const submitted = Boolean(localSubmittedAt);

  const answeredCount = useMemo(
    () => Object.values(responseState).filter((item) => item.completed).length,
    [responseState]
  );

  const progressLabel = `${answeredCount}/${questions.length}`;

  const moveToNextPending = () => {
    for (let i = 0; i < questions.length; i += 1) {
      const index = (currentIndex + 1 + i) % questions.length;
      const question = questions[index];
      if (!responseState[question.id]?.completed) {
        setCurrentIndex(index);
        questionStartRef.current = Date.now();
        return;
      }
    }
    questionStartRef.current = Date.now();
  };

  const startAssignment = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/assignments/${assignmentId}/start`, {
        method: "POST"
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not start assignment.");
      }
      setLocalStarted(true);
      setNotice("Assignment started.");
      questionStartRef.current = Date.now();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start assignment.");
    } finally {
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!currentQuestion || submitted || busy) return;
    const answer = (answerDrafts[currentQuestion.id] ?? "").trim();
    if (!answer) {
      setError("Enter or choose an answer before submitting.");
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const responseMs = Date.now() - questionStartRef.current;
      const response = await fetch(`/api/assignments/${assignmentId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          answer,
          responseMs
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: {
          correct: boolean;
          needsRetry: boolean;
          attempts: number;
          answerText: string;
          alreadyCompleted: boolean;
        };
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "Could not submit answer.");
      }

      const result = payload.result;
      setResponseState((previous) => {
        const existing = previous[currentQuestion.id] ?? {
          questionId: currentQuestion.id,
          attempts: 0,
          completed: false,
          isCorrect: null,
          firstCorrect: null
        };
        if (result.needsRetry) {
          return {
            ...previous,
            [currentQuestion.id]: {
              ...existing,
              attempts: result.attempts,
              completed: false
            }
          };
        }
        return {
          ...previous,
          [currentQuestion.id]: {
            ...existing,
            attempts: result.attempts,
            completed: true,
            isCorrect: result.correct,
            firstCorrect: result.correct && result.attempts === 1
          }
        };
      });

      if (result.needsRetry) {
        setNotice("Incorrect on first try. You have one more attempt.");
        setAnswerDrafts((previous) => ({ ...previous, [currentQuestion.id]: "" }));
      } else if (result.correct) {
        setNotice("Correct.");
        setAnswerDrafts((previous) => ({ ...previous, [currentQuestion.id]: answer }));
        moveToNextPending();
      } else {
        setRevealAnswers((previous) => ({
          ...previous,
          [currentQuestion.id]: result.answerText
        }));
        setNotice(`Submitted. Correct answer: ${result.answerText}`);
        moveToNextPending();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit answer.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const submitAssignment = async () => {
    if (!localStarted || submitted || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
        method: "POST"
      });
      const payload = (await response.json()) as {
        error?: string;
        attempt?: { submittedAt?: string | null };
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not submit assignment.");
      }
      setLocalSubmittedAt(payload.attempt?.submittedAt ?? new Date().toISOString());
      setNotice("Assignment submitted.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit assignment.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="assignment-runner">
      <header className="panel runner-head">
        <div>
          <h3>{title}</h3>
          <p>
            Due {new Date(dueAtIso).toLocaleString()} | Late submissions{" "}
            {allowLateSubmissions ? "enabled" : "disabled"}
          </p>
          <p className="small-note">Progress: {progressLabel}</p>
        </div>
        <div className="buttonRow">
          {!localStarted ? (
            <button className="btn primary" type="button" onClick={() => void startAssignment()} disabled={!canStart || busy}>
              {busy ? "Starting..." : "Start Assignment"}
            </button>
          ) : null}
          {localStarted && !submitted ? (
            <button className="btn secondary" type="button" onClick={() => void submitAssignment()} disabled={busy}>
              {busy ? "Submitting..." : "Submit Assignment"}
            </button>
          ) : null}
        </div>
      </header>

      {submitted ? (
        <article className="panel">
          <h4>Submitted</h4>
          <p>
            Submitted at {new Date(localSubmittedAt ?? "").toLocaleString()}
            {submissionKind ? ` (${submissionKind.replace("_", " ").toLowerCase()})` : ""}
          </p>
          <p className="small-note">
            This assignment is complete. Personal mastery updates were applied in the
            background.
          </p>
        </article>
      ) : null}

      {localStarted && currentQuestion ? (
        <article className="panel">
          <p className="small-note">
            Question {currentQuestion.position} of {questions.length}
          </p>
          <h4>{currentQuestion.prompt}</h4>
          {currentQuestion.subPrompt ? <p>{currentQuestion.subPrompt}</p> : null}

          {currentQuestion.format === "MULTIPLE_CHOICE" ? (
            <div className="choice-grid">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`choice ${
                    (answerDrafts[currentQuestion.id] ?? "") === choice ? "selected" : ""
                  }`}
                  disabled={busy || submitted}
                  onClick={() =>
                    setAnswerDrafts((previous) => ({
                      ...previous,
                      [currentQuestion.id]: choice
                    }))
                  }
                >
                  {choice}
                </button>
              ))}
            </div>
          ) : (
            <label className="field">
              <span>Your answer</span>
              <input
                value={answerDrafts[currentQuestion.id] ?? ""}
                onChange={(event) =>
                  setAnswerDrafts((previous) => ({
                    ...previous,
                    [currentQuestion.id]: event.target.value
                  }))
                }
                disabled={busy || submitted}
              />
            </label>
          )}

          <div className="buttonRow">
            <button className="btn primary" type="button" onClick={() => void submitAnswer()} disabled={busy || submitted}>
              {busy ? "Saving..." : "Submit Answer"}
            </button>
          </div>

          {currentResponse?.completed && currentResponse.isCorrect === false ? (
            <p className="error-copy">
              Correct answer: {revealAnswers[currentQuestion.id] ?? "review in results"}
            </p>
          ) : null}
        </article>
      ) : null}

      {notice ? <p className="success-copy">{notice}</p> : null}
      {error ? <p className="error-copy">{error}</p> : null}
    </section>
  );
}
