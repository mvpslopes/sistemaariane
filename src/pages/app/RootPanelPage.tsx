import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Circle,
  Loader2,
  LogOut,
  RefreshCw,
  Shield,
  Users,
} from 'lucide-react';
import {
  forceLogoutUser,
  getRootAccessLog,
  getRootOnlineUsers,
  getRootUsageMetrics,
  type OnlineUser,
  type RootUsageMetrics,
  type UserAccessLogEntry,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import UserAvatar from '../../components/UserAvatar';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import { auditRoleLabel } from '../../constants/auditLabels';
import { formatDateTimeBR, parseAppDate } from '../../utils/dateTime';

const ONLINE_MINUTES = 5;
const PAGE_SIZE = 50;
const METRICS_DAYS = 30;

function relativeLastSeen(iso: string): string {
  const d = parseAppDate(iso);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'Agora';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `Há ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `Há ${hours} h`;
}

function shortUserAgent(ua: string | null): string {
  if (!ua) return '—';
  if (ua.length <= 48) return ua;
  return `${ua.slice(0, 45)}…`;
}

function formatDayLabel(isoDate: string): string {
  const d = parseAppDate(isoDate);
  if (!d) return isoDate;
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(d);
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}h`;
}

function BarChart({
  items,
  label,
  valueKey,
  labelKey,
  maxBars,
}: {
  items: Array<Record<string, string | number>>;
  label: string;
  valueKey: string;
  labelKey: string;
  maxBars?: number;
}) {
  const slice = maxBars ? items.slice(-maxBars) : items;
  const max = Math.max(1, ...slice.map((i) => Number(i[valueKey] ?? 0)));

  return (
    <div>
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ minHeight: '7rem' }}>
        {slice.map((item, idx) => {
          const value = Number(item[valueKey] ?? 0);
          const height = Math.max(value > 0 ? 8 : 2, Math.round((value / max) * 100));
          return (
            <div key={`${item[labelKey]}-${idx}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-brand-dark-brown">{value || ''}</span>
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className="w-full max-w-[2rem] rounded-t-md bg-brand-brown/80 transition-all"
                  style={{ height: `${height}%`, minHeight: value > 0 ? '0.5rem' : '2px' }}
                  title={`${item[labelKey]}: ${value}`}
                />
              </div>
              <span className="truncate text-[9px] text-brand-olive">{String(item[labelKey])}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RootPanelPage() {
  const { user } = useAuth();
  const { error: toastError, success } = useToast();
  const [online, setOnline] = useState<OnlineUser[]>([]);
  const [accessLog, setAccessLog] = useState<UserAccessLogEntry[]>([]);
  const [metrics, setMetrics] = useState<RootUsageMetrics | null>(null);
  const [totalAccess, setTotalAccess] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingOnline, setLoadingOnline] = useState(true);
  const [loadingLog, setLoadingLog] = useState(true);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logoutTarget, setLogoutTarget] = useState<OnlineUser | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadOnline = useCallback(async () => {
    try {
      const { items } = await getRootOnlineUsers(ONLINE_MINUTES);
      setOnline(items);
    } catch (err: any) {
      toastError(err.message || 'Erro ao carregar usuários online');
    } finally {
      setLoadingOnline(false);
    }
  }, [toastError]);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await getRootUsageMetrics(METRICS_DAYS);
      setMetrics(data);
    } catch (err: any) {
      toastError(err.message || 'Erro ao carregar métricas');
    } finally {
      setLoadingMetrics(false);
    }
  }, [toastError]);

  const loadAccessLog = useCallback(
    async (pageNum = page) => {
      setLoadingLog(true);
      try {
        const { items, total } = await getRootAccessLog(pageNum, PAGE_SIZE);
        setAccessLog(items);
        setTotalAccess(total);
      } catch (err: any) {
        toastError(err.message || 'Erro ao carregar histórico de acessos');
      } finally {
        setLoadingLog(false);
      }
    },
    [page, toastError]
  );

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadOnline(), loadMetrics(), loadAccessLog(page)]);
    setRefreshing(false);
  }, [loadOnline, loadMetrics, loadAccessLog, page]);

  const handleForceLogout = async () => {
    if (!logoutTarget) return;
    setLoggingOut(true);
    try {
      await forceLogoutUser(logoutTarget.id);
      const isSelf = logoutTarget.id === user?.id;
      success(`Sessão de ${logoutTarget.name} encerrada`);
      setLogoutTarget(null);
      if (isSelf) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.assign('/login?expired=1');
        return;
      }
      await loadOnline();
    } catch (err: any) {
      toastError(err.message || 'Erro ao encerrar sessão');
    } finally {
      setLoggingOut(false);
    }
  };

  useEffect(() => {
    loadOnline();
    const id = window.setInterval(loadOnline, 30_000);
    return () => window.clearInterval(id);
  }, [loadOnline]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadAccessLog(page);
  }, [page, loadAccessLog]);

  const totalPages = Math.max(1, Math.ceil(totalAccess / PAGE_SIZE));

  const peakHour = useMemo(() => {
    if (!metrics?.peakHours.length) return null;
    return metrics.peakHours.reduce((best, cur) => (cur.count > best.count ? cur : best));
  }, [metrics]);

  const metricsDayChart = useMemo(
    () =>
      (metrics?.loginsByDay ?? []).map((d) => ({
        date: formatDayLabel(d.date),
        count: d.count,
      })),
    [metrics]
  );

  const metricsHourChart = useMemo(() => {
    if (!metrics) return [];
    return metrics.peakHours
      .filter((h) => h.hour >= 6 && h.hour <= 22)
      .map((h) => ({ hour: formatHourLabel(h.hour), count: h.count }));
  }, [metrics]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-brand-brown" />
            <h1 className="text-lg font-semibold text-brand-dark-brown">Painel Root</h1>
          </div>
          <p className="mt-1 text-sm text-brand-olive">
            Presença, métricas de uso, encerramento de sessão e histórico de logins.
          </p>
        </div>
        <AppButton variant="secondary" onClick={refreshAll} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Atualizar
        </AppButton>
      </div>

      <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-olive" />
          <h2 className="text-sm font-semibold text-brand-dark-brown">
            Métricas de uso · últimos {METRICS_DAYS} dias
          </h2>
        </div>

        {loadingMetrics ? (
          <div className="flex items-center justify-center py-10 text-sm text-brand-olive">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando métricas…
          </div>
        ) : metrics ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-beige bg-brand-off-white/50 px-4 py-3">
                <p className="text-xs text-brand-olive">Logins hoje</p>
                <p className="mt-1 text-2xl font-semibold text-brand-dark-brown">
                  {metrics.summary.loginsToday}
                </p>
              </div>
              <div className="rounded-xl border border-brand-beige bg-brand-off-white/50 px-4 py-3">
                <p className="text-xs text-brand-olive">Logins nos últimos 7 dias</p>
                <p className="mt-1 text-2xl font-semibold text-brand-dark-brown">
                  {metrics.summary.loginsWeek}
                </p>
              </div>
              <div className="rounded-xl border border-brand-beige bg-brand-off-white/50 px-4 py-3">
                <p className="text-xs text-brand-olive">Usuários únicos ({metrics.days}d)</p>
                <p className="mt-1 text-2xl font-semibold text-brand-dark-brown">
                  {metrics.summary.uniqueUsers}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-brand-beige/80 p-4">
                <BarChart
                  items={metricsDayChart}
                  label="Logins por dia (7 dias)"
                  valueKey="count"
                  labelKey="date"
                />
              </div>
              <div className="rounded-xl border border-brand-beige/80 p-4">
                <BarChart
                  items={metricsHourChart}
                  label={`Horários de pico${peakHour ? ` · pico ${formatHourLabel(peakHour.hour)}` : ''}`}
                  valueKey="count"
                  labelKey="hour"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-beige/80 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-olive">
                  Logins por perfil
                </p>
                <ul className="space-y-1.5">
                  {metrics.loginsByRole.length === 0 ? (
                    <li className="text-sm text-brand-olive">Sem dados ainda.</li>
                  ) : (
                    metrics.loginsByRole.map((r) => (
                      <li key={r.role} className="flex items-center justify-between text-sm">
                        <span className="text-brand-dark-brown">{auditRoleLabel(r.role)}</span>
                        <span className="font-medium text-brand-brown">{r.count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div className="rounded-xl border border-brand-beige/80 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand-olive">
                  Usuários ativos por perfil
                </p>
                <ul className="space-y-1.5">
                  {metrics.activeUsersByRole.length === 0 ? (
                    <li className="text-sm text-brand-olive">Sem dados ainda.</li>
                  ) : (
                    metrics.activeUsersByRole.map((r) => (
                      <li key={r.role} className="flex items-center justify-between text-sm">
                        <span className="text-brand-dark-brown">{auditRoleLabel(r.role)}</span>
                        <span className="font-medium text-brand-brown">{r.count}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-olive" />
            <h2 className="text-sm font-semibold text-brand-dark-brown">Online agora</h2>
          </div>
          {!loadingOnline && (
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {online.length} {online.length === 1 ? 'usuário' : 'usuários'}
            </span>
          )}
        </div>

        {loadingOnline ? (
          <div className="flex items-center justify-center py-10 text-sm text-brand-olive">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : online.length === 0 ? (
          <p className="py-8 text-center text-sm text-brand-olive">
            Ninguém online nos últimos {ONLINE_MINUTES} minutos.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {online.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-brand-beige/80 bg-brand-off-white/40 px-3 py-2.5"
              >
                <UserAvatar name={u.name} avatarUrl={u.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-brand-dark-brown">{u.name}</p>
                  <p className="truncate text-xs text-brand-olive">
                    @{u.username} · {auditRoleLabel(u.role)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                    <Circle className="h-2 w-2 fill-current" />
                    Online
                  </span>
                  <span className="text-[10px] text-brand-olive/80">
                    {relativeLastSeen(u.lastSeenAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setLogoutTarget(u)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-600 transition hover:bg-red-50"
                    title="Encerrar sessão"
                  >
                    <LogOut className="h-3 w-3" />
                    Desconectar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-sm">
        <div className="border-b border-brand-beige px-4 py-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-olive" />
            <h2 className="text-sm font-semibold text-brand-dark-brown">Últimos acessos</h2>
          </div>
          <p className="text-xs text-brand-olive">Registro de cada login realizado no sistema.</p>
        </div>

        {loadingLog ? (
          <div className="flex items-center justify-center py-12 text-sm text-brand-olive">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando histórico…
          </div>
        ) : accessLog.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-brand-olive">
            Nenhum acesso registrado ainda. Novos logins aparecerão aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-off-white/60 text-xs uppercase tracking-wide text-brand-olive">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Data/hora</th>
                  <th className="px-4 py-2.5 font-semibold">Usuário</th>
                  <th className="px-4 py-2.5 font-semibold">Perfil</th>
                  <th className="px-4 py-2.5 font-semibold">IP</th>
                  <th className="hidden px-4 py-2.5 font-semibold md:table-cell">Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-beige/70">
                {accessLog.map((row) => (
                  <tr key={row.id} className="hover:bg-brand-off-white/30">
                    <td className="whitespace-nowrap px-4 py-2.5 text-brand-dark-brown">
                      {formatDateTimeBR(row.createdAt, row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <UserAvatar name={row.name} avatarUrl={row.avatarUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-brand-dark-brown">{row.name}</p>
                          <p className="truncate text-xs text-brand-olive">@{row.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-brand-olive">
                      {auditRoleLabel(row.role)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-brand-olive">
                      {row.ip || '—'}
                    </td>
                    <td className="hidden max-w-[14rem] truncate px-4 py-2.5 text-xs text-brand-olive md:table-cell">
                      {shortUserAgent(row.userAgent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-brand-beige px-4 py-3 text-sm">
            <span className="text-brand-olive">
              Página {page} de {totalPages} · {totalAccess} acessos
            </span>
            <div className="flex gap-2">
              <AppButton
                variant="secondary"
                disabled={page <= 1 || loadingLog}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Anterior
              </AppButton>
              <AppButton
                variant="secondary"
                disabled={page >= totalPages || loadingLog}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </AppButton>
            </div>
          </div>
        )}
      </section>

      <Modal
        open={!!logoutTarget}
        onClose={() => !loggingOut && setLogoutTarget(null)}
        title="Encerrar sessão"
      >
        {logoutTarget && (
          <div className="space-y-4">
            <p className="text-sm text-brand-dark-brown">
              Desconectar <strong>{logoutTarget.name}</strong> (@{logoutTarget.username})? A sessão
              atual será invalidada e o usuário precisará fazer login novamente.
            </p>
            {logoutTarget.id === user?.id && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Atenção: você está encerrando a sua própria sessão e será deslogado.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <AppButton variant="secondary" onClick={() => setLogoutTarget(null)} disabled={loggingOut}>
                Cancelar
              </AppButton>
              <AppButton variant="danger" loading={loggingOut} onClick={handleForceLogout}>
                Desconectar
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
