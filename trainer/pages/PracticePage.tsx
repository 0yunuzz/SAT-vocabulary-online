import { useEffect } from "react";
import { ActiveSession, VocabWord } from "../types";

interface PracticePageProps {
  session?: ActiveSession;
  wordsById: Map<string, VocabWord>;
  bookmarkedWordIds: Set<string>;
  onSelectChoice: (choiceId: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  onSkip: () => void;
  onToggleBookmark: (wordId: string) => void;
  onEndSession: () => void;
}

export const PracticePage = ({
  session,
  wordsById,
  bookmarkedWordIds,
  onSelectChoice,
  onSubmit,
  onNext,
  onSkip,
  onToggleBookmark,
  onEndSession,
}: PracticePageProps) => {
  const question = session ? session.questions[session.currentIndex] : undefined;
  const targetWord = question ? wordsById.get(question.wordId) : undefined;

  useEffect(() => {
    if (!session || !question) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target && ["INPUT", "TEXTAREA"].includes(target.tagName);

      if (event.key.toLowerCase() === "s" && !isTyping) {
        event.preventDefault();
        if (!session.feedback || session.feedback.status === "retry") {
          onSkip();
        }
        return;
      }

      if (event.key.toLowerCase() === "b" && targetWord && !isTyping) {
        event.preventDefault();
        onToggleBookmark(targetWord.id);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (session.feedback && session.feedback.status !== "retry") {
          onNext();
        } else {
          onSubmit();
        }
        return;
      }

      if (!session.feedback || session.feedback.status === "retry") {
        const index = Number(event.key) - 1;
        if (index >= 0 && index < question.choices.length) {
          onSelectChoice(question.choices[index].id);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [session, question, targetWord, onSkip, onToggleBookmark, onNext, onSubmit, onSelectChoice]);

  if (!session || !question) {
    return (
      <section className="page">
        <div className="panel empty-state">
          <h3>No active session</h3>
          <p>Start a session from Practice or Dashboard quick start.</p>
        </div>
      </section>
    );
  }

  const progressLabel = `${session.currentIndex + 1}/${session.questions.length}`;
  const feedbackResolved = session.feedback && session.feedback.status !== "retry";

  return (
    <section className="page practice-page">
      <header className="practice-header panel">
        <div>
          <h2>Practice Session</h2>
          <p>
            Question {progressLabel} | Attempt {session.currentAttempt} of 2
          </p>
        </div>

        <div className="practice-meta">
          {session.config.timerMode === "question" ? (
            <span className="timer-chip">Question timer: {session.questionRemainingSec ?? 0}s</span>
          ) : null}
          {session.config.timerMode === "session" ? (
            <span className="timer-chip">Session timer: {session.sessionRemainingSec ?? 0}s</span>
          ) : null}
          {targetWord ? (
            <button className="btn ghost" onClick={() => onToggleBookmark(targetWord.id)}>
              {bookmarkedWordIds.has(targetWord.id) ? "Unbookmark" : "Bookmark"}
            </button>
          ) : null}
          <button className="btn ghost" onClick={onEndSession}>
            End Session
          </button>
        </div>
      </header>

      <article className="panel question-panel">
        <p className="question-type">{question.type.replace(/_/g, " ")}</p>
        <h3>{question.prompt}</h3>
        {question.subPrompt ? <p className="sub-copy">{question.subPrompt}</p> : null}

        <div className="choice-grid">
          {question.choices.map((choice, index) => {
            const selected = session.selectedChoiceId === choice.id;
            const revealCorrect = feedbackResolved && choice.id === question.answerChoiceId;
            const revealWrong =
              feedbackResolved &&
              selected &&
              choice.id !== question.answerChoiceId &&
              session.feedback?.status === "revealed";

            return (
              <button
                key={choice.id}
                className={`choice ${selected ? "selected" : ""} ${revealCorrect ? "correct" : ""} ${revealWrong ? "wrong" : ""}`}
                onClick={() => onSelectChoice(choice.id)}
                disabled={Boolean(feedbackResolved)}
              >
                <span>{index + 1}.</span>
                {choice.label}
              </button>
            );
          })}
        </div>

        {session.feedback ? (
          <div className={`feedback ${session.feedback.status}`}>
            <p>{session.feedback.message}</p>
          </div>
        ) : null}

        <div className="question-actions">
          {!feedbackResolved ? (
            <>
              <button className="btn secondary" onClick={onSkip}>
                Skip (S)
              </button>
              <button className="btn primary" onClick={onSubmit}>
                Submit (Enter)
              </button>
            </>
          ) : (
            <button className="btn primary" onClick={onNext}>
              Next Question (Enter)
            </button>
          )}
        </div>
      </article>

      {feedbackResolved && targetWord ? (
        <article className="panel reveal-panel">
          <h3>Word Review</h3>
          <p>
            <strong>{targetWord.word}</strong>: {targetWord.definition}
          </p>
          <blockquote>{targetWord.exampleSentence}</blockquote>
          <div className="word-meta-grid">
            <p>
              <span>Part of speech</span>
              <strong>{targetWord.partOfSpeech ?? "-"}</strong>
            </p>
            <p>
              <span>Synonyms</span>
              <strong>{targetWord.synonyms.length ? targetWord.synonyms.join(", ") : "-"}</strong>
            </p>
            <p>
              <span>Source group</span>
              <strong>{targetWord.sourceGroup ?? "-"}</strong>
            </p>
            <p>
              <span>Notes</span>
              <strong>{targetWord.notes ?? "-"}</strong>
            </p>
          </div>
        </article>
      ) : null}

      <p className="small-note">Shortcuts: 1-4 choose option, Enter submit/next, S skip, B bookmark.</p>
    </section>
  );
};

