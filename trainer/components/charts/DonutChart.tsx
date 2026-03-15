interface DonutChartProps {
  values: Array<{ label: string; value: number; color: string }>;
}

export const DonutChart = ({ values }: DonutChartProps) => {
  const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 0;

  const segments = values
    .map((item) => {
      const angle = (item.value / total) * 360;
      const segment = `${item.color} ${offset}deg ${offset + angle}deg`;
      offset += angle;
      return segment;
    })
    .join(", ");

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: `conic-gradient(${segments})` }}>
        <div className="donut-hole">
          <strong>{total}</strong>
          <span>words</span>
        </div>
      </div>
      <div className="donut-legend">
        {values.map((item) => (
          <p key={item.label}>
            <span style={{ background: item.color }} />
            {item.label}: {item.value}
          </p>
        ))}
      </div>
    </div>
  );
};
