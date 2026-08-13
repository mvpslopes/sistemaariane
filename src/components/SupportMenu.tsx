import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Headphones, MessageCircle, Phone } from 'lucide-react';
import {
  TECH_SUPPORT,
  buildSupportMessage,
  supportWhatsAppHref,
} from '../constants/support';

interface SupportMenuProps {
  userName?: string;
  compact?: boolean;
}

export default function SupportMenu({ userName, compact = false }: SupportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  const waHref = supportWhatsAppHref(buildSupportMessage(userName, pathname));

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown transition hover:bg-brand-off-white ${
          compact ? 'h-10 w-10' : 'gap-1.5 px-2.5 py-2 sm:px-3'
        }`}
        title="Suporte técnico"
        aria-label="Suporte técnico"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Headphones className="h-4 w-4" />
        {!compact && <span className="hidden text-xs font-medium lg:inline">Suporte</span>}
      </button>

      {open && (
        <div
          className="fixed right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] z-[61] w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-2xl sm:right-4 md:right-6"
          role="dialog"
          aria-label="Suporte técnico"
        >
          <div className="border-b border-brand-beige px-4 py-3">
            <p className="text-sm font-semibold text-neutral-950">Suporte técnico</p>
            <p className="text-xs text-neutral-600">{TECH_SUPPORT.contactName}</p>
          </div>

          <div className="space-y-3 p-4">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1ebe5d]"
            >
              <MessageCircle className="h-4 w-4" />
              Chamar no WhatsApp
            </a>

            <div className="flex items-center gap-2 rounded-xl border border-brand-beige bg-brand-off-white/60 px-3 py-2.5 text-sm text-neutral-800">
              <Phone className="h-4 w-4 shrink-0 text-brand-brown" />
              <span>{TECH_SUPPORT.phoneDisplay}</span>
            </div>

            <p className="text-xs leading-relaxed text-neutral-600">
              Horário: {TECH_SUPPORT.hours}. Descreva o problema e informe em qual tela você estava.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
