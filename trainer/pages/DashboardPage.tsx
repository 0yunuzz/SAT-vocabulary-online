import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/charts/BarChart";
import { ActivityBars } from "../components/charts/ActivityBars";
import { DonutChart } from "../components/charts/DonutChart";
import { getQuestionTypeLabel } from "../domain/session";
import {
  buildDashboardMetrics,
  leastSeenWords,
  masteryDistribution,
  modeBreakdown,
  mostMissedWords,
  recentSessions,
  studyActivity,
} from "../domain/selectors";
import { AppData, SessionConfig, VocabWord } from "../types";
import { formatDuration, formatDateTime } from "../utils/date";

interface DashboardPageProps {
  words: VocabWord[];
  appData: AppData;
  onStartQuickSession: (config: SessionConfig) => void;
}

const pct = (value: number): string => `${Math.round(value * 100)}%`;

export const DashboardPage = ({ words, appData, onStartQuickSession }: DashboardPageProps) => {
  const metrics = buildDashboardMetrics(words, appData);
  const missed = mostMissedWords(words, appData, 6);
  const leastSeen = leastSeenWords(words, appData, 6);
  const sessions = recentSessions(appData, 4);
  const activity = studyActivity(appData, 14);
  const distribution = masteryDistribution(words, appData);
  const modes = modeBreakdown(appData).filter((entry) => entry.answered > 0);

  return (
    <section className="page page-dashboard">
      <header className="page-header">
        <div>
          <h2>Study Dashboard</h2>
          <p>Track retention, target weak vocabulary, and keep your momentum daily.</p>
        </div>
        <div className="header-actions">
          <button
            className="btn primary"
            onClick={() =>
              onStartQuickSession({
                mode: "mixed",
                questionCount: 20,
                timerMode: "untimed",
                customBucket: "all",
                customQuestionTypes: [],
                questionTimeLimitSec: 20,
                sessionTimeLimitSec: 600,
              })
            }
          >
            Practice 20 Mixed Questions
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              onStartQuickSession({
                mode: "weak_words",
                questionCount: 20,
                timerMode: "untimed",
                customBucket: "weak",
                customQuestionTypes: [],
                questionTimeLimitSec: 20,
                sessionTimeLimitSec: 600,
              })
            }
          >
            Continue Weak Words
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              onStartQuickSession({
                mode: "recent_words",
                questionCount: 20,
                timerMode: "untimed",
                customBucket: "recent",
                customQuestionTypes: [],
                questionTimeLimitSec: 20,
                sessionTimeLimitSec: 600,
              })
            }
          >
            Resume Recent Mode
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <StatCard label="Total words" value={String(metrics.totalWords)} />
        <StatCard label="Words practiced" value={String(metrics.wordsPracticed)} hint="Seen at least once" />
        <StatCard label="Mastered" value={String(metrics.masteredWords)} hint="Stable recall" />
        <StatCard label="Weak words" value={String(metrics.weakWords)} hint="High-priority review" trend="down" emphasis="strong" />
        <StatCard label="Bookmarked" value={String(metrics.bookmarkedWords)} />
        <StatCard label="Overall accuracy" value={pct(metrics.overallAccuracy)} />
        <StatCard label="First-try accuracy" value={pct(metrics.firstTryAccuracy)} />
        <StatCard label="Second-try recovery" value={pct(metrics.secondTryRecovery)} />
        <StatCard label="Current streak" value={String(metrics.currentStreak)} />
        <StatCard label="Longest streak" value={String(metrics.longestStreak)} />
        <StatCard label="Avg response" value={formatDuration(metrics.avgResponseMs)} />
      </div>

      <div className="dashboard-panels">
        <article className="panel">
          <h3>Study Activity (14 days)</h3>
          <ActivityBars points={activity} />
        </article>

        <article className="panel">
          <h3>Mastery Distribution</h3>
          <DonutChart
            values={[
              { label: "Unseen", value: distribution.unseen, color: "#9ba3b7" },
              { label: "Weak", value: distribution.weak, color: "#d46f4d" },
              { label: "Learning", value: distribution.learning, color: "#f1bd63" },
              { label: "Mastered", value: distribution.mastered, color: "#4b8f74" },
            ]}
          />
        </article>

        <article className="panel">
          <h3>Mode Performance</h3>
          {modes.length ? (
            <BarChart
              data={modes.map((mode) => ({
                label: getQuestionTypeLabel(mode.type),
                value: mode.accuracy * 100,
                subtitle: `${Math.round(mode.accuracy * 100)}% (${mode.answered})`,
              }))}
              max={100}
            />
          ) : (
            <p className="empty-copy">No mode data yet. Start a session to populate this panel.</p>
          )}
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Most Missed Words</h3>
          {missed.length ? (
            <ul className="word-list compact">
              {missed.map((word) => (
                <li key={word.id}>
                  <strong>{word.word}</strong>
                  <span>{appData.wordProgress[word.id]?.missed ?? 0} misses</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No persistent misses yet. Keep building exposure.</p>
          )}
        </article>

        <article className="panel">
          <h3>Least Seen Words</h3>
          <ul className="word-list compact">
            {leastSeen.map((word) => (
              <li key={word.id}>
                <strong>{word.word}</strong>
                <span>{appData.wordProgress[word.id]?.timesSeen ?? 0} times seen</span>
              </li>
            ))}
          </ul>
        </article>
      </div>

      <article className="panel">
        <h3>Recent Sessions</h3>
        {sessions.length ? (
          <div className="session-grid">
            {sessions.map((session) => (
              <div key={session.id} className="session-row">
                <strong>{session.mode.replace("_", " ")}</strong>
                <span>{Math.round(session.accuracy * 100)}% accuracy</span>
                <span>{session.questionCount} questions</span>
                <span>{formatDateTime(session.endedAt)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-copy">No sessions yet. Your first study session will appear here.</p>
        )}
      </article>
    </section>
  );
};
