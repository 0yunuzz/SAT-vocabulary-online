import { StatCard } from "../components/StatCard";
import { ActivityBars } from "../components/charts/ActivityBars";
import {
  buildDetailedStatistics,
  modeBreakdown,
  mostMissedWords,
  studyActivity
} from "../domain/selectors";
import { AppData, VocabWord } from "../types";
import { formatDuration } from "../utils/date";

interface StatisticsPageProps {
  words: VocabWord[];
  appData: AppData;
}

const pct = (value: number): string => `${Math.round(value * 100)}%`;

export const StatisticsPage = ({ words, appData }: StatisticsPageProps) => {
  const stats = buildDetailedStatistics(words, appData);
  const weakWords = words
    .filter((word) => (appData.wordProgress[word.id]?.masteryScore ?? 0) < 60)
    .sort(
      (a, b) =>
        (appData.wordProgress[a.id]?.masteryScore ?? 0) -
        (appData.wordProgress[b.id]?.masteryScore ?? 0)
    )
    .slice(0, 10);
  const missedWords = mostMissedWords(words, appData, 10);
  const modeStats = modeBreakdown(appData).filter((entry) => entry.answered > 0);
  const activity = studyActivity(appData, 30);

  return (
    <section className="page page-statistics">
      <header className="page-header">
        <div>
          <h2>Statistics</h2>
          <p>Detailed trends for performance, consistency, timing, and problem vocabulary.</p>
        </div>
      </header>

      <article className="panel">
        <h3>Accuracy & Performance</h3>
        <div className="stats-grid">
          <StatCard label="First-try accuracy" value={pct(stats.firstTryAccuracy)} />
          <StatCard label="Second-try accuracy" value={pct(stats.secondTryAccuracy)} />
          <StatCard label="Words practiced" value={String(stats.wordsPracticed)} />
          <StatCard label="Mastered words" value={String(stats.masteredWords)} />
          <StatCard
            label="Weak words"
            value={String(stats.weakWordCount)}
            hint="Low-mastery words"
            trend="down"
            emphasis="strong"
          />
        </div>
      </article>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Streak & Consistency</h3>
          <div className="stats-grid">
            <StatCard label="Longest streak" value={String(stats.longestStreak)} />
            <StatCard label="Total sessions" value={String(stats.totalSessions)} />
            <StatCard label="7-day questions" value={String(stats.sevenDayQuestions)} />
            <StatCard label="Recent session accuracy" value={pct(stats.sevenDayAccuracy)} />
          </div>
        </article>

        <article className="panel">
          <h3>Timing</h3>
          <div className="stats-grid">
            <StatCard label="Average response time" value={formatDuration(stats.averageResponseMs)} />
            <StatCard
              label="Avg questions/session"
              value={stats.averageQuestionsPerSession.toFixed(1)}
            />
          </div>
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Weak Words</h3>
          {weakWords.length ? (
            <ul className="word-list compact">
              {weakWords.map((word) => (
                <li key={word.id}>
                  <strong>{word.word}</strong>
                  <span>{Math.round(appData.wordProgress[word.id]?.masteryScore ?? 0)}% mastery</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No weak words right now.</p>
          )}
        </article>

        <article className="panel">
          <h3>Most Missed Words</h3>
          {missedWords.length ? (
            <ul className="word-list compact">
              {missedWords.map((word) => (
                <li key={word.id}>
                  <strong>{word.word}</strong>
                  <span>{appData.wordProgress[word.id]?.missed ?? 0} misses</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No persistent misses yet.</p>
          )}
        </article>
      </div>

      <div className="dashboard-panels two-col">
        <article className="panel">
          <h3>Mode Trends</h3>
          {modeStats.length ? (
            <ul className="word-list compact">
              {modeStats.map((mode) => (
                <li key={mode.type}>
                  <strong>{mode.type.replaceAll("_", " ")}</strong>
                  <span>{pct(mode.accuracy)} on {mode.answered} answers</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-copy">No mode trends yet.</p>
          )}
        </article>

        <article className="panel">
          <h3>30-Day Activity</h3>
          <ActivityBars points={activity} />
        </article>
      </div>
    </section>
  );
};
