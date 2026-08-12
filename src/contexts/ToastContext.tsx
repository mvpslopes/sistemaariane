import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useIsMobile } from '../hooks/useIsMobile';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  toast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 4500;
const MAX_VISIBLE_TOASTS = 3;

const typeConfig = {
  success: {
    label: 'Sucesso',
    Icon: CheckCircle2,
    container: 'border-brand-forest/20 bg-white/95 text-brand-dark-brown',
    accent: 'bg-brand-forest',
    iconWrap: 'bg-brand-forest/10 text-brand-forest ring-1 ring-brand-forest/15',
    progress: 'bg-brand-forest',
  },
  error: {
    label: 'Erro',
    Icon: AlertCircle,
    container: 'border-red-200/80 bg-white/95 text-brand-dark-brown',
    accent: 'bg-red-500',
    iconWrap: 'bg-red-50 text-red-600 ring-1 ring-red-100',
    progress: 'bg-red-500',
  },
  info: {
    label: 'Informação',
    Icon: Info,
    container: 'border-brand-gold/35 bg-white/95 text-brand-dark-brown',
    accent: 'bg-brand-gold',
    iconWrap: 'bg-brand-gold/12 text-brand-gold ring-1 ring-brand-gold/20',
    progress: 'bg-brand-gold',
  },
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE_TOASTS - 1)), { id, type, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const success = useCallback((message: string) => toast(message, 'success'), [toast]);
  const error = useCallback((message: string) => toast(message, 'error'), [toast]);
  const info = useCallback((message: string) => toast(message, 'info'), [toast]);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      toast,
      success,
      error,
      info,
      dismiss,
    }),
    [toasts, toast, success, error, info, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const isMobile = useIsMobile();

  if (!toasts.length) return null;

  return (
    <div
      className={
        isMobile
          ? 'pointer-events-none fixed inset-x-0 top-0 z-[110] flex flex-col gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]'
          : 'pointer-events-none fixed bottom-5 right-5 z-[110] flex w-[min(100%-2.5rem,26rem)] flex-col gap-2.5'
      }
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => (
        <ToastCard
          key={t.id}
          toast={t}
          isMobile={isMobile}
          onDismiss={() => onDismiss(t.id)}
        />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  isMobile,
  onDismiss,
}: {
  toast: ToastItem;
  isMobile: boolean;
  onDismiss: () => void;
}) {
  const config = typeConfig[toast.type];
  const { Icon, label, container, accent, iconWrap, progress } = config;

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border shadow-card backdrop-blur-md ${container} ${
        isMobile ? 'animate-toast-slide-down' : 'animate-toast-slide-up'
      }`}
      role="status"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${accent}`} aria-hidden />

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        <span
          className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
        >
          <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-brown/80">
            {label}
          </p>
          <p className="mt-0.5 text-sm font-medium leading-snug text-brand-dark-brown">
            {toast.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 mt-0.5 shrink-0 rounded-xl p-1.5 text-brand-brown/60 transition hover:bg-brand-off-white hover:text-brand-dark-brown"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1 bg-brand-beige/40">
        <div
          className={`h-full origin-left ${progress}`}
          style={{
            animation: `toastProgress ${AUTO_DISMISS_MS}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
