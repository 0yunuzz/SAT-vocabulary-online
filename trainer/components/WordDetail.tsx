import { VocabWord, WordProgress } from "../types";
import { wordStatus } from "../domain/mastery";
import { formatDateTime } from "../utils/date";

interface WordDetailProps {
  word: VocabWord;
  progress?: WordProgress;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
}

export const WordDetail = ({ word, progress, bookmarked, onToggleBookmark, onClose }: WordDetailProps) => {
  const status = wordStatus(progress);
  const timesSeen = progress?.timesSeen ?? 0;
  const firstTryRate = progress?.timesSeen
    ? progress.firstTryCorrect / Math.max(progress.timesSeen, 1)
    : 0;

  return (
    <section className="word-detail" aria-live="polite">
      <button className="text-button" onClick={onClose}>
        Close
      </button>
      <h3>{word.word}</h3>
      <p className="word-detail-definition">{word.definition}</p>
      <blockquote>{word.exampleSentence}</blockquote>

      <div className="word-meta-grid">
        <p>
          <span>Part of speech</span>
          <strong>{word.partOfSpeech ?? "-"}</strong>
        </p>
        <p>
          <span>Synonyms</span>
          <strong>{word.synonyms.length ? word.synonyms.join(", ") : "-"}</strong>
        </p>
        <p>
          <span>Mastery</span>
          <strong>{Math.round(progress?.masteryScore ?? 0)}%</strong>
        </p>
        <p>
          <span>Status</span>
          <strong>{status}</strong>
        </p>
        <p>
          <span>Times seen</span>
          <strong>{timesSeen}</strong>
        </p>
        <p>
          <span>First-try rate</span>
          <strong>{Math.round(firstTryRate * 100)}%</strong>
        </p>
      </div>

      {progress ? (
        <div className="word-outcomes">
          <p>First try: {progress.firstTryCorrect}</p>
          <p>Second try: {progress.secondTryCorrect}</p>
          <p>Missed: {progress.missed}</p>
          <p>Skipped: {progress.skipped}</p>
        </div>
      ) : null}

      <div className="panel">
        <h4>Recent Performance</h4>
        {progress?.recentEvents.length ? (
          <ul className="word-list compact">
            {progress.recentEvents.slice(0, 6).map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <strong>{event.outcome.replace("_", " ")}</strong>
                <span>{event.questionType.replace("_", " ")}</span>
                <span>{formatDateTime(event.at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small-note">No recent performance history yet.</p>
        )}
      </div>

      <button className="btn secondary" onClick={onToggleBookmark}>
        {bookmarked ? "Remove bookmark" : "Bookmark word"}
      </button>
    </section>
  );
};
