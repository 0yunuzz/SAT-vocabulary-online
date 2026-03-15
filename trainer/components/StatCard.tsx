import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  trend?: "up" | "down" | "neutral";
  emphasis?: "default" | "strong";
  rightSlot?: ReactNode;
}

export const StatCard = ({ label, value, hint, trend = "neutral", emphasis = "default", rightSlot }: StatCardProps) => {
  return (
    <article className={`stat-card ${emphasis === "strong" ? "strong" : ""}`}>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint ? <p className={`stat-hint trend-${trend}`}>{hint}</p> : null}
      </div>
      {rightSlot ? <div className="stat-side">{rightSlot}</div> : null}
    </article>
  );
};
