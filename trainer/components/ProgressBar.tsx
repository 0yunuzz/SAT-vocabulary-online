interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
}

export const ProgressBar = ({ value, max = 100, label }: ProgressBarProps) => {
  const percent = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));

  return (
    <div className="progress-wrap" aria-label={label ?? "progress"}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      {label ? <span className="progress-label">{label}</span> : null}
    </div>
  );
};
