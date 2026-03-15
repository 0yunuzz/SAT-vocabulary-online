import { SessionSummary, VocabWord } from "../types";
import { formatDuration } from "../utils/date";

interface ResultsPageProps {
  summary?: SessionSummary;
  wordsById: Map<string, VocabWord>;
  onReviewMissed: () => void;
  onRetrySession: () => void;
  onContinueWeakWords: () => void;
  onReturnDashboard: () => void;
}

const renderWords = (ids: string[], wordsById: Map<string, VocabWord>) =>
  ids
    .map((id) => wordsById.get(id)?.word)
    .filter(Boolean)
    .join(", ");

export const ResultsPage = ({
  summary,
  wordsById,
  onReviewMissed,
  onRetrySession,
  onContinueWeakWords,
  onReturnDashboard,
}: ResultsPageProps) => {
  if (!summary) {
    return (
      <section className="page">
        <div className="panel empty-state">
          <h3>No recent session</h3>
          <p>Complete a practice session to see detailed results.</p>
          <button className="btn primary" onClick={onReturnDashboard}>
            Back to dashboard
          </button>
        </div>
      </section>
    );
  }

  const session = summary.session;
  const correct = session.firstTryCorrect + session.secondTryCorrect;

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <h2>Session Results</h2>
          <p>{summary.recommendedAction}</p>
        </div>
      </header>

      <div className="stats-grid">
        <article className="stat-card">
          <p className="stat-label">Total correct</p>
          <p className="stat-value">{correct}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">First-try correct</p>
          <p className="stat-value">{session.firstTryCorrect}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Second-try correct</p>
          <p className="stat-value">{session.secondTryCorrect}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Missed</p>
          <p className="stat-value">{session.missed}</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Accuracy</p>
          <p className="stat-value">{Math.round(session.accuracy * 100)}%</p>
        </article>
        <article className="stat-card">
          <p className="stat-label">Avg response</p>
          <p className="stat-value">{formatDuration(session.averageResponseMs)}</p>
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Words Struggled With</h3>
          <p>{summary.struggledWords.length ? renderWords(summary.struggledWords, wordsById) : "No major struggle words in this session."}</p>
        </article>

        <article className="panel">
          <h3>Strongest Words</h3>
          <p>{summary.strongWords.length ? renderWords(summary.strongWords, wordsById) : "Complete more questions to rank strongest recalls."}</p>
        </article>
      </div>

      <div className="result-actions">
        <button className="btn secondary" onClick={onReviewMissed}>
          Review Missed Words
        </button>
        <button className="btn secondary" onClick={onRetrySession}>
          Retry Session
        </button>
        <button className="btn secondary" onClick={onContinueWeakWords}>
          Continue With Weak Words
        </button>
        <button className="btn primary" onClick={onReturnDashboard}>
          Return to Dashboard
        </button>
      </div>
    </section>
  );
};
