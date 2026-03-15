interface BarDatum {
  label: string;
  value: number;
  subtitle?: string;
}

interface BarChartProps {
  data: BarDatum[];
  max?: number;
}

export const BarChart = ({ data, max }: BarChartProps) => {
  const maxValue = max ?? Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="bar-chart" role="img" aria-label="Bar chart">
      {data.map((item) => {
        const width = Math.max(4, (item.value / maxValue) * 100);
        return (
          <div key={item.label} className="bar-row">
            <div className="bar-head">
              <span>{item.label}</span>
              <span>{item.subtitle ?? item.value.toFixed(0)}</span>
            </div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${width}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};
