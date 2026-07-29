interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  title: string;
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
}

export default function DonutChart({ title, slices, size = 160, thickness = 22 }: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let offset = 0;
  const arcs =
    total === 0
      ? []
      : slices
          .filter((s) => s.value > 0)
          .map((slice) => {
            const length = (slice.value / total) * circumference;
            const arc = {
              ...slice,
              dash: `${length} ${circumference - length}`,
              offset: -offset,
              pct: Math.round((slice.value / total) * 100),
            };
            offset += length;
            return arc;
          });

  return (
    <div className="rounded-2xl border border-brand-beige bg-white p-5 shadow-card">
      <h3 className="mb-4 text-sm font-semibold text-brand-dark-brown">{title}</h3>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="#E6D8C3"
              strokeWidth={thickness}
              opacity={0.45}
            />
            {arcs.map((arc) => (
              <circle
                key={arc.label}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={thickness}
                strokeDasharray={arc.dash}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                className="transition-all duration-500"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-semibold text-brand-dark-brown">{total}</p>
            <p className="text-[10px] uppercase tracking-wide text-brand-olive">total</p>
          </div>
        </div>

        <ul className="w-full space-y-2 sm:max-w-[55%]">
          {slices.map((slice) => {
            const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
            return (
              <li key={slice.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-brand-dark-brown">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="shrink-0 tabular-nums text-brand-olive">
                  {slice.value} · {pct}%
                </span>
              </li>
            );
          })}
          {total === 0 && (
            <li className="text-xs text-brand-olive">Sem dados para exibir</li>
          )}
        </ul>
      </div>
    </div>
  );
}
