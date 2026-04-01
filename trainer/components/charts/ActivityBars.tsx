interface ActivityPoint {
  date: string;
  questions: number;
  correct: number;
  incorrect: number;
}

interface ActivityBarsProps {
  points: ActivityPoint[];
}

export const ActivityBars = ({ points }: ActivityBarsProps) => {
  const max = Math.max(...points.map((p) => p.questions), 1);

  return (
    <div
      className="activity-bars"
      role="img"
      aria-label="Study activity chart"
      style={{ gridTemplateColumns: `repeat(${Math.max(points.length, 1)}, minmax(12px, 1fr))` }}
    >
      {points.map((point) => {
        const correctHeight = (point.correct / max) * 100;
        const incorrectHeight = (point.incorrect / max) * 100;
        const label = point.date.slice(5);

        return (
          <div className="activity-column" key={point.date} title={`Questions: ${point.questions}`}>
            <div className="activity-bar-stack">
              <div
                className="activity-bar-segment correct"
                style={{ height: `${correctHeight}%` }}
              />
              <div
                className="activity-bar-segment incorrect"
                style={{ height: `${incorrectHeight}%`, bottom: `${correctHeight}%` }}
              />
            </div>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
};
