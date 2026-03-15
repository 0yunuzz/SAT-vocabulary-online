interface ActivityPoint {
  date: string;
  questions: number;
}

interface ActivityBarsProps {
  points: ActivityPoint[];
}

export const ActivityBars = ({ points }: ActivityBarsProps) => {
  const max = Math.max(...points.map((p) => p.questions), 1);

  return (
    <div className="activity-bars" role="img" aria-label="Study activity chart">
      {points.map((point) => {
        const height = Math.max(8, (point.questions / max) * 100);
        const label = point.date.slice(5);

        return (
          <div className="activity-column" key={point.date} title={`${point.date}: ${point.questions} questions`}>
            <div className="activity-bar" style={{ height: `${height}%` }} />
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
};
