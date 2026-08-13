import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, CheckCheck, ChevronRight, Loader2 } from 'lucide-react';
import type { DashboardStats } from '../services/apiService';
import { useNotificationReads } from '../hooks/useNotificationReads';

interface NotificationBellProps {
  userId?: string;
  stats: DashboardStats | null;
  canManageSubs: boolean;
  loading?: boolean;
  compact?: boolean;
}

export default function NotificationBell({
  userId,
  stats,
  canManageSubs,
  loading = false,
  compact = false,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { alerts, unreadCount, isUnread, markAsRead, markAllAsRead } = useNotificationReads(
    userId,
    stats,
    canManageSubs
  );

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
        className={`relative inline-flex items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown transition hover:bg-brand-off-white ${
          compact ? 'h-10 w-10' : 'h-10 w-10 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-2.5 sm:py-2'
        }`}
        title="Notificações"
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lida(s)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-4 w-4" />
        {!compact && <span className="hidden text-xs font-medium lg:inline">Avisos</span>}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.25rem))] z-[61] w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-2xl sm:right-4 md:right-6"
          role="dialog"
          aria-label="Notificações importantes"
        >
          <div className="flex items-center justify-between gap-2 border-b border-brand-beige px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-neutral-950">Avisos importantes</p>
              <p className="text-xs text-neutral-600">
                {unreadCount > 0 ? `${unreadCount} não lido(s)` : 'Tudo em dia'}
              </p>
            </div>
            {alerts.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-brown transition hover:bg-brand-off-white"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar lidas
              </button>
            )}
          </div>

          <div className="max-h-[min(24rem,60vh)] overflow-y-auto p-2">
            {loading && !stats ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </div>
            ) : alerts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-neutral-600">
                Nenhum aviso operacional no momento.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {alerts.map((a) => {
                  const unread = isUnread(a);
                  return (
                    <li key={a.id}>
                      <Link
                        to={a.to}
                        onClick={() => {
                          markAsRead(a);
                          setOpen(false);
                        }}
                        className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm transition hover:shadow-sm ${
                          a.tone === 'warn'
                            ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                            : 'border-brand-beige bg-white text-neutral-950'
                        } ${unread ? 'ring-1 ring-brand-gold/30' : 'opacity-80'}`}
                      >
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            a.tone === 'warn' ? 'text-amber-600' : 'text-brand-olive'
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block font-medium">{a.title}</span>
                            {unread && (
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" aria-hidden />
                            )}
                          </span>
                          <span className="block text-xs opacity-80">{a.subtitle}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 opacity-40" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-brand-beige px-4 py-2.5">
            <Link
              to="/app"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-brown hover:underline"
            >
              Ver resumo na dashboard →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
