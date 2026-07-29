import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const sizes = {
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export default function Modal({ open, title, subtitle, onClose, children, size = 'xl' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-brand-dark-brown/50 backdrop-blur-[2px]"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border border-brand-beige bg-white shadow-2xl animate-scale-in sm:rounded-2xl ${sizes[size]}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-brand-beige px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark-brown">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-brand-olive">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-brand-olive hover:bg-brand-beige/40 hover:text-brand-dark-brown"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}
