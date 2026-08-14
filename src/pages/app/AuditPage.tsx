import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  LogIn,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import { getAuditLogs, type AuditLogEntry } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { FilterPills } from '../../components/FilterPills';
import AppButton from '../../components/AppButton';
import {
  AUDIT_ACTION_FILTERS,
  AUDIT_RESOURCE_FILTERS,
  auditActionLabel,
  auditResourceLabel,
  auditRoleLabel,
} from '../../constants/auditLabels';
import { formatDateTimeBR } from '../../utils/dateTime';

const PAGE_SIZE = 50;

function defaultFromDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

const fmtDate = (iso: string) => formatDateTimeBR(iso, iso);

const actionBadgeClassMap: Record<string, string> = {
  login_failed: 'bg-red-50 text-red-700',
  login: 'bg-emerald-50 text-emerald-700',
  delete: 'bg-red-50/70 text-red-800',
  create: 'bg-brand-forest/15 text-brand-forest',
  sign: 'bg-emerald-50 text-emerald-800',
  clicksign_send: 'bg-blue-50 text-blue-800',
  clicksign_notify: 'bg-blue-50/70 text-blue-700',
  clicksign_cancel: 'bg-amber-50 text-amber-800',
  status_change: 'bg-brand-gold/20 text-brand-dark-brown',
  assistant_query: 'bg-violet-50 text-violet-800',
};

function actionBadgeClass(action: string, success: boolean) {
  if (!success) return 'bg-red-50 text-red-700';
  return actionBadgeClassMap[action] || 'bg-brand-beige/50 text-brand-dark-brown';
}

function exportAuditCsv(rows: AuditLogEntry[]) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['Data/hora', 'Usuário', 'Perfil', 'Ação', 'Recurso', 'ID', 'Detalhe', 'IP', 'Sucesso'];
  const lines = rows.map((row) =>
    [
      fmtDate(row.createdAt),
      row.username || '',
      auditRoleLabel(row.role),
      auditActionLabel(row.action),
      auditResourceLabel(row.resource),
      row.resourceId || '',
      row.summary || '',
      row.ip || '',
      row.success ? 'Sim' : 'Não',
    ]
      .map(escape)
      .join(';')
  );
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `auditoria-${todayDate()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditPage() {
  const { error: toastError, success } = useToast();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(todayDate);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs({
        q: debouncedQ || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        resource: resourceFilter !== 'all' ? resourceFilter : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, debouncedQ, fromDate, page, resourceFilter, toastError, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, debouncedQ, fromDate, resourceFilter, toDate]);

  const pageStats = useMemo(() => {
    const failures = items.filter((i) => i.action === 'login_failed' || !i.success).length;
    const logins = items.filter((i) => i.action === 'login').length;
    const mutations = items.filter((i) => ['create', 'update', 'delete'].includes(i.action)).length;
    return { failures, logins, mutations };
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await getAuditLogs({
        q: debouncedQ || undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        resource: resourceFilter !== 'all' ? resourceFilter : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 500,
        offset: 0,
      });
      if (res.items.length === 0) {
        toastError('Nenhum registro para exportar');
        return;
      }
      exportAuditCsv(res.items);
      success(`Exportados ${res.items.length} registro(s)`);
    } catch (e: any) {
      toastError(e.message || 'Erro ao exportar');
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setQ('');
    setDebouncedQ('');
    setActionFilter('all');
    setResourceFilter('all');
    setFromDate(defaultFromDate());
    setToDate(todayDate());
    setPage(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-brand-beige bg-brand-off-white/50 p-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-brand-olive" />
          <div>
            <h2 className="text-sm font-semibold text-brand-dark-brown">Auditoria de acessos e ações</h2>
            <p className="mt-1 text-xs text-brand-olive">
              Histórico de logins e alterações no sistema. Visível apenas para administradores.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <AppButton type="button" variant="secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </AppButton>
          <AppButton type="button" variant="secondary" onClick={onExport} loading={exporting}>
            <Download className="h-4 w-4" />
            Exportar CSV
          </AppButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Registros no filtro" value={total} />
        <StatCard label="Logins (página)" value={pageStats.logins} icon={LogIn} tone="success" />
        <StatCard label="Alterações (página)" value={pageStats.mutations} tone="neutral" />
        <StatCard label="Falhas (página)" value={pageStats.failures} icon={AlertTriangle} tone="danger" />
      </div>

      <div className="space-y-3 rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">De</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Até</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </label>
          <label className="block space-y-1 md:col-span-2 xl:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Buscar</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Usuário, detalhe, IP ou ID do registro..."
                className="w-full rounded-xl border border-brand-beige py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              />
            </div>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Tipo de ação</p>
          <FilterPills
            options={AUDIT_ACTION_FILTERS.map((opt) => ({ ...opt }))}
            value={actionFilter}
            onChange={setActionFilter}
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="block min-w-[12rem] flex-1 space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Módulo</span>
            <select
              value={resourceFilter}
              onChange={(e) => setResourceFilter(e.target.value)}
              className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            >
              {AUDIT_RESOURCE_FILTERS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-brand-beige px-3 py-2.5 text-sm text-brand-brown hover:bg-brand-off-white"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {loading ? (
        <ListPageSkeleton variant="table" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-brand-beige bg-white shadow-card">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-off-white text-brand-olive">
                <tr>
                  <th className="w-8 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3 font-medium">Data/hora</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Ação</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Módulo</th>
                  <th className="px-4 py-3 font-medium">Detalhe</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-brand-olive">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
                {items.map((row) => {
                  const expanded = expandedId === row.id;
                  const hasDetails = Boolean(row.meta || row.userAgent);
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-t border-brand-beige/60 ${expanded ? 'bg-brand-off-white/80' : 'hover:bg-brand-off-white/70'}`}
                      >
                        <td className="px-2 py-3">
                          {hasDetails ? (
                            <button
                              type="button"
                              onClick={() => setExpandedId(expanded ? null : row.id)}
                              className="rounded-lg p-1 text-brand-olive hover:bg-brand-beige/40"
                              aria-label={expanded ? 'Recolher detalhes' : 'Ver detalhes'}
                            >
                              <ChevronDown className={`h-4 w-4 transition ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-brand-brown">{fmtDate(row.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-brand-dark-brown">{row.username || '—'}</div>
                          <div className="text-xs text-brand-olive">{auditRoleLabel(row.role)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${actionBadgeClass(row.action, row.success)}`}
                          >
                            {auditActionLabel(row.action)}
                          </span>
                        </td>
                        <td className="hidden px-4 py-3 text-brand-brown md:table-cell">
                          {auditResourceLabel(row.resource)}
                          {row.resourceId ? (
                            <span className="ml-1 text-xs text-brand-olive">#{row.resourceId}</span>
                          ) : null}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-brand-brown">
                          <div className="truncate" title={row.summary || ''}>
                            {row.summary || '—'}
                          </div>
                          <div className="mt-0.5 text-xs text-brand-olive md:hidden">
                            {auditResourceLabel(row.resource)}
                            {row.resourceId ? ` #${row.resourceId}` : ''}
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-brand-olive lg:table-cell">
                          {row.ip || '—'}
                        </td>
                      </tr>
                      {expanded && hasDetails && (
                        <tr className="border-t border-brand-beige/40 bg-brand-off-white/50">
                          <td colSpan={7} className="px-4 py-3">
                            <AuditDetailPanel row={row} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-beige bg-white px-4 py-3 text-sm shadow-card">
            <p className="text-brand-olive">
              {total === 0
                ? 'Nenhum registro'
                : `Mostrando ${rangeStart}–${rangeEnd} de ${total} registro(s)`}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-beige px-3 py-1.5 text-brand-brown disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className="px-2 text-brand-olive">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-brand-beige px-3 py-1.5 text-brand-brown disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  icon?: typeof Shield;
  tone?: 'neutral' | 'success' | 'danger';
}) {
  const toneClass =
    tone === 'success'
      ? 'text-brand-forest'
      : tone === 'danger'
        ? 'text-red-600'
        : 'text-brand-dark-brown';

  return (
    <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
        {Icon ? <Icon className={`h-4 w-4 ${toneClass}`} /> : null}
      </div>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function AuditDetailPanel({ row }: { row: AuditLogEntry }) {
  return (
    <div className="grid gap-3 text-sm md:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Informações técnicas</p>
        <dl className="space-y-1 text-brand-brown">
          <div className="flex gap-2">
            <dt className="text-brand-olive">ID do log:</dt>
            <dd>{row.id}</dd>
          </div>
          {row.userId && (
            <div className="flex gap-2">
              <dt className="text-brand-olive">ID usuário:</dt>
              <dd>{row.userId}</dd>
            </div>
          )}
          {row.resourceId && (
            <div className="flex gap-2">
              <dt className="text-brand-olive">ID recurso:</dt>
              <dd>{row.resourceId}</dd>
            </div>
          )}
          {row.ip && (
            <div className="flex gap-2">
              <dt className="text-brand-olive">IP:</dt>
              <dd className="font-mono">{row.ip}</dd>
            </div>
          )}
        </dl>
      </div>
      {row.userAgent && (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Navegador / dispositivo</p>
          <p className="break-all text-xs text-brand-brown">{row.userAgent}</p>
        </div>
      )}
      {row.meta && Object.keys(row.meta).length > 0 && (
        <div className="space-y-1 md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Dados adicionais</p>
          <pre className="max-h-48 overflow-auto rounded-xl bg-brand-off-white p-3 text-xs text-brand-dark-brown">
            {JSON.stringify(row.meta, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
