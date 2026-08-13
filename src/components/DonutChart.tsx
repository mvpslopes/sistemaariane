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
  /** 'currency' formata em R$; 'count' usa número simples (padrão). */
  valueType?: 'count' | 'currency';
  /** Tipografia escura/preto para melhor contraste (ex.: dashboard). */
  highContrast?: boolean;
}

function formatLegendValue(value: number, valueType: 'count' | 'currency') {
  if (valueType === 'currency') {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  return value.toLocaleString('pt-BR');
}

function formatCenterValue(total: number, valueType: 'count' | 'currency') {
  if (valueType === 'currency') {
    const full = total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (full.length > 11 || total >= 1_000_000) {
      return total.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: total >= 1_000_000 ? 1 : 2,
      });
    }
    return full;
  }
  return total.toLocaleString('pt-BR');
}

function centerTextClass(formatted: string, valueType: 'count' | 'currency') {
  const len = formatted.length;
  if (valueType === 'currency') {
    if (len <= 9) return 'text-lg';
    if (len <= 12) return 'text-base';
    if (len <= 15) return 'text-sm';
    return 'text-[11px]';
  }
  if (len <= 4) return 'text-2xl';
  if (len <= 7) return 'text-xl';
  if (len <= 10) return 'text-lg';
  return 'text-base';
}

export default function DonutChart({
  title,
  slices,
  size: sizeProp,
  thickness: thicknessProp,
  valueType = 'count',
  highContrast = false,
}: DonutChartProps) {
  const size = sizeProp ?? (valueType === 'currency' ? 148 : 132);
  const thickness = thicknessProp ?? (valueType === 'currency' ? 16 : 18);

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const centerLabel = formatCenterValue(total, valueType);
  const centerTitle =
    valueType === 'currency'
      ? total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : centerLabel;
  const innerSize = Math.max(56, size - thickness * 2 - 10);

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

  const titleClass = highContrast ? 'text-neutral-950' : 'text-brand-dark-brown';
  const valueClass = highContrast ? 'text-neutral-950' : 'text-brand-dark-brown';
  const mutedClass = highContrast ? 'text-neutral-600' : 'text-brand-olive';

  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-beige bg-white p-4 shadow-card sm:p-5">
      <h3 className={`mb-3 text-sm font-semibold ${titleClass}`}>{title}</h3>

      <div className="mx-auto mb-4 shrink-0" style={{ width: size, height: size }}>
        <div className="relative" style={{ width: size, height: size }}>
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
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-center"
            style={{ width: innerSize }}
          >
            <p
              className={`w-full font-semibold leading-tight tabular-nums ${valueClass} ${centerTextClass(centerLabel, valueType)}`}
              title={centerTitle}
            >
              {centerLabel}
            </p>
            <p className={`mt-0.5 text-[10px] uppercase tracking-wide ${mutedClass}`}>total</p>
          </div>
        </div>
      </div>

      <ul className="w-full space-y-2">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          const legendValue = formatLegendValue(slice.value, valueType);
          return (
            <li key={slice.label} className="flex items-start gap-2 text-sm">
              <span
                className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className={`min-w-0 flex-1 leading-snug ${valueClass}`}>{slice.label}</span>
              <span
                className={`shrink-0 text-right text-xs tabular-nums sm:text-sm ${mutedClass}`}
                title={legendValue}
              >
                <span className="block max-w-[9rem] truncate sm:max-w-none">{legendValue}</span>
                <span className="block">{pct}%</span>
              </span>
            </li>
          );
        })}
        {total === 0 && <li className={`text-xs ${mutedClass}`}>Sem dados para exibir</li>}
      </ul>
    </div>
  );
}
