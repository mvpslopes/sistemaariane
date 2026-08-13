import { useEffect, useState } from 'react';
import { formatLongDateBR, formatTimeBR } from '../utils/dateTime';

/** Data longa + hora atual (Brasília), atualiza a cada segundo. */
export default function HeaderDateTime({ className = '' }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <p className={`text-xs capitalize text-brand-olive/70 ${className}`}>
      {formatLongDateBR(now)}
      <span className="mx-1.5 text-brand-gold/70">·</span>
      <span className="tabular-nums normal-case tracking-wide text-brand-dark-brown/80">
        {formatTimeBR(now)}
      </span>
    </p>
  );
}
