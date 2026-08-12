import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useAnimatedPresence } from '../hooks/useAnimatedPresence';
import { useIsMobile } from '../hooks/useIsMobile';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | '2xl';
}

const sizes = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  '2xl': 'max-w-4xl',
};

/** Contador global: modais aninhados não deixam o body travado. */
let openModalCount = 0;

function lockBodyScroll() {
  openModalCount += 1;
  if (openModalCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockBodyScroll() {
  openModalCount = Math.max(0, openModalCount - 1);
  if (openModalCount === 0) {
    document.body.style.overflow = '';
  }
}

export default function Modal({ open, title, subtitle, onClose, children, size = 'xl' }: ModalProps) {
  const isMobile = useIsMobile();
  const { mounted, visible, duration } = useAnimatedPresence(open, 300);

  useEffect(() => {
    if (!mounted) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlockBodyScroll();
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className={`absolute inset-0 bg-brand-dark-brown/50 backdrop-blur-[2px] transition-opacity ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${duration}ms` }}
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden border border-brand-beige bg-white shadow-2xl transition-all sm:rounded-2xl ${sizes[size]} ${
          isMobile ? 'rounded-t-2xl' : 'rounded-2xl'
        } ${visible ? (isMobile ? 'translate-y-0 opacity-100' : 'scale-100 opacity-100') : isMobile ? 'translate-y-full opacity-0' : 'scale-95 opacity-0'}`}
        style={{ transitionDuration: `${duration}ms`, transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-beige px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-brand-dark-brown sm:text-lg">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-brand-olive sm:text-sm">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-brand-olive transition hover:bg-brand-beige/40 hover:text-brand-dark-brown active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">{children}</div>
      </div>
    </div>
  );
}
