import { PenLine } from 'lucide-react';

interface ContractSignatureProgressProps {
  signedCount?: number | null;
  totalCount?: number | null;
  compact?: boolean;
  /** Versão mínima para células de tabela. */
  variant?: 'default' | 'table';
  loading?: boolean;
}

/** Indicador visual de progresso de assinaturas Clicksign. */
export default function ContractSignatureProgress({
  signedCount,
  totalCount,
  compact = false,
  variant = 'default',
  loading = false,
}: ContractSignatureProgressProps) {
  if (loading) {
    return (
      <div
        className={`inline-flex animate-pulse items-center gap-2 rounded-full bg-brand-beige/30 ${
          variant === 'table' ? 'px-1 py-0.5' : compact ? 'px-2 py-1' : 'px-2.5 py-1'
        }`}
      >
        <span className={`rounded-full bg-brand-beige/60 ${variant === 'table' ? 'h-5 w-5' : 'h-6 w-6'}`} />
        {variant !== 'table' && <span className="h-3 w-16 rounded bg-brand-beige/60" />}
      </div>
    );
  }

  const total = totalCount ?? 0;
  if (total <= 0) return null;

  const signed = Math.min(Math.max(signedCount ?? 0, 0), total);
  const pending = total - signed;
  if (pending <= 0) return null;

  const pct = Math.round((signed / total) * 100);
  const circumference = 2 * Math.PI * 14;
  const dash = (pct / 100) * circumference;
  const title = `${signed} de ${total} assinaturas concluídas · faltam ${pending}`;

  if (variant === 'table') {
    const ringSize = 'h-6 w-6';
    return (
      <div className="inline-flex items-center gap-1" title={title}>
        <div className="relative shrink-0">
          <svg className={`${ringSize} -rotate-90`} viewBox="0 0 36 36" aria-hidden>
            <circle cx="18" cy="18" r="14" fill="none" stroke="#EDE4D8" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="14"
              fill="none"
              stroke="#C4A574"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
            />
          </svg>
          <PenLine className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 text-brand-brown/80" />
        </div>
        <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-brand-dark-brown">
          {signed}/{total}
        </span>
        <span className="whitespace-nowrap text-[10px] text-amber-800/90">
          · faltam {pending}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-gradient-to-r from-amber-50/95 via-white to-amber-50/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      }`}
      title={title}
    >
      <div className="relative shrink-0">
        <svg className="h-8 w-8 -rotate-90" viewBox="0 0 36 36" aria-hidden>
          <circle cx="18" cy="18" r="14" fill="none" stroke="#EDE4D8" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="#C4A574"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <PenLine className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-brand-brown/80" />
      </div>

      <div className="min-w-0 leading-tight">
        <p className="text-[11px] font-semibold tabular-nums text-brand-dark-brown">
          {signed}/{total}
          <span className="font-normal text-brand-olive"> assinaturas</span>
        </p>
        <p className="text-[10px] font-medium text-amber-800/90">
          {pending === 1 ? 'Falta 1 assinatura' : `Faltam ${pending} assinaturas`}
        </p>
      </div>

      {!compact && (
        <div className="hidden items-center gap-0.5 sm:flex" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i < signed
                  ? 'bg-emerald-500 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                  : 'bg-brand-beige ring-1 ring-amber-300/60'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
