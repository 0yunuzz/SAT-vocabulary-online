import type { ReactNode } from "react";

export interface StatItem {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatGrid({ items, footer }: { items: StatItem[]; footer?: ReactNode }) {
  return (
    <section className="panel">
      <div className="statsGrid">
        {items.map((item) => (
          <article className="statCard" key={item.label}>
            <p className="statLabel">{item.label}</p>
            <p className="statValue">{item.value}</p>
            {item.hint ? <p className="muted">{item.hint}</p> : null}
          </article>
        ))}
      </div>
      {footer ? <div className="panelFooter">{footer}</div> : null}
    </section>
  );
}
