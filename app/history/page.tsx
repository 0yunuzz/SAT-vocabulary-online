"use client";

import { ModeBadge } from "@/components/mode-badge";
import { useStudyData } from "@/utils/use-study-data";

export default function HistoryPage() {
  const { snapshot, mode, syncStatus } = useStudyData();

  return (
    <>
      <section className="panel splitColumns">
        <div>
          <h2>Session History</h2>
          <ModeBadge mode={mode} syncStatus={syncStatus} />
        </div>
        <div>
          <p className="muted">
            Review past study sessions, accuracy, and total questions.
          </p>
        </div>
      </section>

      <section className="panel">
        {snapshot.sessions.length === 0 ? (
          <p className="muted">No sessions recorded yet.</p>
        ) : (
          <table className="tableLike">
            <thead>
              <tr>
                <th>Date</th>
                <th>Mode</th>
                <th>Questions</th>
                <th>Correct</th>
                <th>Accuracy</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sessions.map((session) => (
                <tr key={session.id}>
                  <td>{new Date(session.startedAt).toLocaleString()}</td>
                  <td>{session.mode.replaceAll("_", " ")}</td>
                  <td>{session.totalQuestions}</td>
                  <td>{session.correctAnswers}</td>
                  <td>{Math.round(session.accuracy * 100)}%</td>
                  <td>{session.durationSec}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
