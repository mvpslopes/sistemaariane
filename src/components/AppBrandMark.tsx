import { Link } from 'react-router-dom';

interface AppBrandMarkProps {
  compact?: boolean;
  className?: string;
}

function Monogram({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-9 w-9 text-xs' : 'h-11 w-11 text-sm';
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-xl border border-brand-gold/35 bg-gradient-to-br from-brand-gold/25 to-brand-gold/10 font-bold tracking-tight text-brand-gold shadow-inner ${box}`}
      aria-hidden
    >
      AA
    </span>
  );
}

/** Marca no sidebar — logo branca da assessoria (sem miniatura pixelada). */
export default function AppBrandMark({ compact = false, className = '' }: AppBrandMarkProps) {
  if (compact) {
    return (
      <Link
        to="/app"
        className={`group flex justify-center ${className}`}
        title="Ariane Andrade Assessoria · Gestão de Haras"
      >
        <Monogram />
      </Link>
    );
  }

  return (
    <Link to="/app" className={`group block min-w-0 flex-1 ${className}`}>
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition group-hover:border-brand-gold/30">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-gold/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center space-y-2.5 text-center">
          <img
            src="/logo-ariane-wide_branco.png"
            alt="Ariane Andrade Assessoria"
            className="mx-auto h-9 w-auto max-w-full object-contain drop-shadow-sm"
            onError={(e) => {
              const el = e.target as HTMLImageElement;
              el.style.display = 'none';
              const fb = el.nextElementSibling as HTMLElement | null;
              if (fb) fb.classList.remove('hidden');
            }}
          />
          <p className="hidden text-base font-semibold leading-tight tracking-wide text-white">
            Ariane Andrade
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-px w-5 shrink bg-gradient-to-r from-transparent via-brand-gold to-brand-gold/20" />
            <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.12em] text-brand-gold/95">
              Gestão de Haras
            </span>
            <span className="h-px w-5 shrink bg-gradient-to-l from-transparent via-brand-gold to-brand-gold/20" />
          </div>
        </div>
      </div>
    </Link>
  );
}
