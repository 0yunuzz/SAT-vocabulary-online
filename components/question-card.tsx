"use client";

import type { QuizQuestion } from "@/lib/types";

interface QuestionCardProps {
  question: QuizQuestion;
  questionNumber: number;
  isRetry: boolean;
  selectedChoice?: string;
  feedback?: string;
  onSelect: (choice: string) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  isRetry,
  selectedChoice,
  feedback,
  onSelect
}: QuestionCardProps) {
  return (
    <section className="panel quizCard">
      <div className="quizHeader">
        <span className="eyebrow">Question {questionNumber}</span>
        <span className="pill">{question.mode.replaceAll("_", " ")}</span>
      </div>
      <h2>{question.prompt}</h2>
      {question.helperText ? <p className="muted">{question.helperText}</p> : null}
      {isRetry ? (
        <p className="warningText">First answer was incorrect. One retry available.</p>
      ) : null}
      <div className="choiceGrid">
        {question.choices.map((choice) => {
          const selected = selectedChoice === choice;
          return (
            <button
              key={choice}
              type="button"
              className={`choiceButton ${selected ? "selected" : ""}`}
              onClick={() => onSelect(choice)}
            >
              {choice}
            </button>
          );
        })}
      </div>
      {feedback ? <p className="statusText">{feedback}</p> : null}
    </section>
  );
}
