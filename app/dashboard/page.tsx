"use client";

import { ACHIEVEMENTS } from "@/lib/achievements";
import { ModeBadge } from "@/components/mode-badge";
import { StatGrid } from "@/components/stat-grid";
import { useStudyData } from "@/utils/use-study-data";

export default function DashboardPage() {
  const { snapshot, mode, syncStatus } = useStudyData();
  const values = Object.values(snapshot.wordProgress);
  const attempts = values.reduce((sum, item) => sum + item.attempts, 0);
  const correct = values.reduce((sum, item) => sum + item.correctAnswers, 0);
  const incorrect = values.reduce((sum, item) => sum + item.incorrectAnswers, 0);
  const avgMastery =
    values.length > 0
      ? Math.round(
          (values.reduce((sum, item) => sum + item.masteryScore, 0) / values.length) * 100
        )
      : 0;
  const avgResponse =
    values.length > 0
      ? Math.round(
          values.reduce((sum, item) => sum + (item.averageResponseMs || 0), 0) / values.length
        )
      : 0;
  const accuracy = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;

  return (
    <>
      <section className="panel splitColumns">
        <div>
          <h2>Progress Dashboard</h2>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
          <p className="muted">
            Track mastery, weak words, streaks, and session consistency.
          </p>
        </div>
        <div>
          <p>
            Current streak: <strong>{snapshot.streak.currentStreak}</strong> day(s)
          </p>
          <p>
            Longest streak: <strong>{snapshot.streak.longestStreak}</strong> day(s)
          </p>
          <p>
            Last study date:{" "}
            <strong>
              {snapshot.streak.lastStudyDate
                ? new Date(snapshot.streak.lastStudyDate).toLocaleDateString()
                : "No sessions yet"}
            </strong>
          </p>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "Attempts", value: attempts },
          { label: "Correct", value: correct },
          { label: "Incorrect", value: incorrect },
          { label: "Accuracy", value: `${accuracy}%` },
          { label: "Average Mastery", value: `${avgMastery}%` },
          { label: "Avg Response", value: `${avgResponse} ms` },
          { label: "Bookmarks", value: snapshot.bookmarks.length },
          { label: "Sessions", value: snapshot.sessions.length }
        ]}
      />

      <section className="panel">
        <h3>Achievements</h3>
        <div className="libraryList">
          {ACHIEVEMENTS.map((achievement) => {
            const unlocked = snapshot.achievements.includes(achievement.key);
            return (
              <article className="libraryItem" key={achievement.key}>
                <div className="buttonRow">
                  <strong>{achievement.title}</strong>
                  <span className="pill">{unlocked ? "Unlocked" : "Locked"}</span>
                </div>
                <p className="muted">{achievement.description}</p>
                <p className="muted">Points: {achievement.points}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
