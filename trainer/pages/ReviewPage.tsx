import { classifyWordSets } from "../domain/adaptive";
import { AppData, SessionConfig, VocabWord } from "../types";

interface ReviewPageProps {
  words: VocabWord[];
  appData: AppData;
  onStartSession: (config: SessionConfig) => void;
  onToggleBookmark: (wordId: string) => void;
}

const buildConfig = (mode: SessionConfig["mode"], bucket: SessionConfig["customBucket"]): SessionConfig => ({
  mode,
  questionCount: 20,
  timerMode: "untimed",
  customBucket: bucket,
  customQuestionTypes: [],
  questionTimeLimitSec: 20,
  sessionTimeLimitSec: 600,
});

export const ReviewPage = ({ words, appData, onStartSession, onToggleBookmark }: ReviewPageProps) => {
  const sets = classifyWordSets(words, appData);
  const bookmarkedSet = new Set(appData.bookmarks);
  const recentSet = new Set(appData.recentWordIds);
  const missed = words.filter((word) => (appData.wordProgress[word.id]?.missed ?? 0) > 0).slice(0, 30);
  const bookmarked = words.filter((word) => bookmarkedSet.has(word.id)).slice(0, 30);
  const recent = words.filter((word) => recentSet.has(word.id)).slice(0, 30);

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Review</h2>
          <p>Target specific subsets to close memory gaps efficiently.</p>
        </div>
      </header>

      <div className="review-grid">
        <article className="panel">
          <div className="panel-head-row">
            <h3>Weak Words ({sets.weak.length})</h3>
            <button className="btn secondary" onClick={() => onStartSession(buildConfig("weak_words", "weak"))}>
              Practice Weak
            </button>
          </div>
          <ul className="word-list">
            {sets.weak.slice(0, 20).map((word) => (
              <li key={word.id}>
                <strong>{word.word}</strong>
                <span>{Math.round(appData.wordProgress[word.id]?.masteryScore ?? 0)}% mastery</span>
                <button className="text-button" onClick={() => onToggleBookmark(word.id)}>
                  {bookmarkedSet.has(word.id) ? "Unbookmark" : "Bookmark"}
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head-row">
            <h3>Missed Words ({missed.length})</h3>
            <button className="btn secondary" onClick={() => onStartSession(buildConfig("missed_words", "missed"))}>
              Review Missed
            </button>
          </div>
          <ul className="word-list">
            {missed.map((word) => (
              <li key={word.id}>
                <strong>{word.word}</strong>
                <span>{appData.wordProgress[word.id]?.missed ?? 0} misses</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head-row">
            <h3>Bookmarked ({bookmarked.length})</h3>
            <button className="btn secondary" onClick={() => onStartSession(buildConfig("bookmarked_words", "bookmarked"))}>
              Practice Bookmarks
            </button>
          </div>
          <ul className="word-list">
            {bookmarked.map((word) => (
              <li key={word.id}>
                <strong>{word.word}</strong>
                <button className="text-button" onClick={() => onToggleBookmark(word.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="panel">
          <div className="panel-head-row">
            <h3>Recent Words ({recent.length})</h3>
            <button className="btn secondary" onClick={() => onStartSession(buildConfig("recent_words", "recent"))}>
              Continue Recent
            </button>
          </div>
          <ul className="word-list">
            {recent.map((word) => (
              <li key={word.id}>
                <strong>{word.word}</strong>
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
};
