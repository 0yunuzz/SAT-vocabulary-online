import { StatCard } from "../components/StatCard";
import { BarChart } from "../components/charts/BarChart";
import { ActivityBars } from "../components/charts/ActivityBars";
import { DonutChart } from "../components/charts/DonutChart";
import { getQuestionTypeLabel } from "../domain/session";
import {
  buildDashboardMetrics,
  masteryDistribution,
  modeBreakdown,
  recentSessions,
  studyActivity,
} from "../domain/selectors";
import { AppData, SessionConfig, VocabWord } from "../types";
import { formatDateTime } from "../utils/date";

interface DashboardPageProps {
  words: VocabWord[];
  appData: AppData;
  onStartQuickSession: (config: SessionConfig) => void;
}

const pct = (value: number): string => `${Math.round(value * 100)}%`;

export const DashboardPage = ({ words, appData, onStartQuickSession }: DashboardPageProps) => {
  const metrics = buildDashboardMetrics(appData);
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
        <StatCard label="Total questions solved" value={String(metrics.totalQuestionsSolved)} />
        <StatCard label="Total accuracy" value={pct(metrics.overallAccuracy)} />
        <StatCard label="Current streak" value={String(metrics.currentStreak)} />
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
