import { useEffect, useMemo, useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { getAuditLogs, type AuditLogEntry } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, sortRows } from '../../hooks/useSortableTable';
import { formatDateTimeBR } from '../../utils/dateTime';

type ActionFilter = 'all' | string;
type SortKey = 'createdAt' | 'username' | 'action' | 'resource' | 'summary';

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  login_failed: 'Login falhou',
  create: 'Criação',
  update: 'Alteração',
  delete: 'Exclusão',
};

const ACTION_FILTERS = [
  { id: 'all', label: 'Todas' },
  { id: 'login', label: 'Logins' },
  { id: 'login_failed', label: 'Falhas' },
  { id: 'create', label: 'Criações' },
  { id: 'update', label: 'Alterações' },
  { id: 'delete', label: 'Exclusões' },
];

const fmtDate = (iso: string) => formatDateTimeBR(iso, iso);

export default function AuditPage() {
  const { error: toastError } = useToast();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const effectiveKey = sortKey ?? 'createdAt';
  const effectiveDir = sortKey ? sortDir : 'desc';

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAuditLogs());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar auditoria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const actionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    items.forEach((i) => {
      counts[i.action] = (counts[i.action] || 0) + 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((row) => {
      if (actionFilter !== 'all' && row.action !== actionFilter) return false;
      if (!search) return true;
      return (
        (row.username || '').toLowerCase().includes(search) ||
        (row.summary || '').toLowerCase().includes(search) ||
        row.resource.toLowerCase().includes(search) ||
        (row.resourceId || '').includes(search)
      );
    });

    return sortRows(list, effectiveKey, effectiveDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'createdAt':
          return cmpStr(a.createdAt, b.createdAt);
        case 'username':
          return cmpStr(a.username, b.username);
        case 'action':
          return cmpStr(a.action, b.action);
        case 'resource':
          return cmpStr(a.resource, b.resource);
        case 'summary':
          return cmpStr(a.summary, b.summary);
        default:
          return 0;
      }
    });
  }, [items, q, actionFilter, effectiveKey, effectiveDir]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-brand-beige bg-brand-off-white/50 p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-brand-olive" />
        <div>
          <h2 className="text-sm font-semibold text-brand-dark-brown">Auditoria de acessos e ações</h2>
          <p className="mt-1 text-xs text-brand-olive">
            Registro de logins e alterações no sistema. Visível apenas para administradores.
          </p>
        </div>
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por usuário, recurso ou descrição..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <FilterPills
            options={ACTION_FILTERS.map((opt) => ({
              ...opt,
              count: opt.id === 'all' ? actionCounts.all : actionCounts[opt.id] || 0,
            }))}
            value={actionFilter}
            onChange={setActionFilter}
          />
        }
      />

      {loading ? (
        <ListPageSkeleton variant="table" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh label="Data/hora" column="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Usuário" column="username" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Ação" column="action" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Recurso" column="resource" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Detalhe" column="summary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="hidden px-4 py-3 font-medium lg:table-cell">IP</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                  <td className="whitespace-nowrap px-4 py-3 text-brand-brown">{fmtDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-brand-dark-brown">{row.username || '—'}</div>
                    {row.role && <div className="text-xs capitalize text-brand-olive">{row.role}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        row.success
                          ? row.action === 'login_failed'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-brand-beige/50 text-brand-dark-brown'
                          : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {ACTION_LABELS[row.action] || row.action}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">
                    {row.resource}
                    {row.resourceId ? ` #${row.resourceId}` : ''}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-brand-brown" title={row.summary || ''}>
                    {row.summary || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-brand-olive lg:table-cell">{row.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
