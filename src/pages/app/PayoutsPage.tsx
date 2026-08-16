import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getPayouts, reversePayout, updatePayout, type Payout, type PayoutStatus } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, cmpNum, sortRows } from '../../hooks/useSortableTable';
import { formatDateBR } from '../../utils/dateTime';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusTone: Record<string, string> = {
  aguardando: 'bg-brand-beige/60 text-brand-olive',
  pendente: 'bg-amber-50 text-amber-800',
  pago: 'bg-emerald-50 text-emerald-700',
  cancelado: 'bg-brand-beige/60 text-brand-olive',
};

const statusLabel: Record<PayoutStatus, string> = {
  aguardando: 'Aguardando cobrança',
  pendente: 'Pendente de repasse',
  pago: 'Repassado',
  cancelado: 'Cancelado',
};

const roleLabel: Record<string, string> = {
  assessoria: 'Assessoria',
  seller: 'Vendedor',
  assessor: 'Assessor',
  outro: 'Outro',
};

type StatusFilter = 'all' | PayoutStatus;
type SortKey = 'animal' | 'beneficiary' | 'installment' | 'pct' | 'amount' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'aguardando', label: 'Aguardando cobrança' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'pago', label: 'Repassados' },
  { id: 'cancelado', label: 'Cancelados' },
];

const STATUS_ORDER: Record<PayoutStatus, number> = {
  aguardando: 0,
  pendente: 1,
  pago: 2,
  cancelado: 3,
};

export default function PayoutsPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getPayouts());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar repasses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id: string, next: PayoutStatus) => {
    if (!canWrite) return;
    setUpdatingId(id);
    try {
      await updatePayout(id, { status: next });
      success(next === 'pago' ? 'Repasse marcado como pago' : 'Status atualizado');
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  const reverse = async (payout: Payout) => {
    if (!canWrite) return;
    const beneficiary = payout.label || payout.beneficiary_name || roleLabel[payout.beneficiary_role] || 'beneficiário';
    if (
      !confirm(
        `Estornar repasse de ${beneficiary} (${money(payout.amount)})?\n\nO status voltará para pendente/aguardando.`
      )
    ) {
      return;
    }
    setUpdatingId(payout.id);
    try {
      await reversePayout(payout.id);
      success('Repasse estornado');
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao estornar repasse');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: items.length,
      aguardando: 0,
      pendente: 0,
      pago: 0,
      cancelado: 0,
    };
    items.forEach((i) => {
      if (counts[i.status] !== undefined) counts[i.status] += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!search) return true;
      const beneficiary = p.label || p.beneficiary_name || roleLabel[p.beneficiary_role] || '';
      return (
        (p.animal_name || '').toLowerCase().includes(search) ||
        beneficiary.toLowerCase().includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'animal':
          return cmpStr(a.animal_name, b.animal_name);
        case 'beneficiary':
          return cmpStr(
            a.label || a.beneficiary_name || roleLabel[a.beneficiary_role],
            b.label || b.beneficiary_name || roleLabel[b.beneficiary_role]
          );
        case 'installment':
          return cmpNum(a.installment_no, b.installment_no);
        case 'pct':
          return cmpNum(a.pct, b.pct);
        case 'amount':
          return cmpNum(a.amount, b.amount);
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, sortKey, sortDir]);

  const waiting = items.filter((i) => i.status === 'aguardando').length;
  const pending = items.filter((i) => i.status === 'pendente').length;
  const paid = items.filter((i) => i.status === 'pago').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          repasses ·{' '}
          <span className="font-semibold text-brand-dark-brown">{waiting}</span> aguardando ·{' '}
          <span className="font-semibold text-brand-dark-brown">{pending}</span> pendentes ·{' '}
          <span className="font-semibold text-brand-dark-brown">{paid}</span> repassados
        </p>
      </div>

      <p className="text-xs text-brand-olive">
        Quando a cobrança do comprador é marcada como paga, o repasse correspondente fica{' '}
        <strong>pendente</strong> para você baixar (assessoria, dono e assessores).
      </p>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por animal ou beneficiário..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <FilterPills
            options={STATUS_FILTERS.map((opt) => ({ ...opt, count: statusCounts[opt.id] }))}
            value={statusFilter}
            onChange={setStatusFilter}
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
                <SortTh label="Animal" column="animal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Beneficiário" column="beneficiary" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Parcela" column="installment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="%" column="pct" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Valor" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum repasse encontrado — configure % na venda/contrato
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-brand-beige/70">
                  <td className="px-4 py-3 font-medium text-brand-dark-brown">{p.animal_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{p.label || p.beneficiary_name || roleLabel[p.beneficiary_role]}</div>
                    <div className="text-xs text-brand-olive">
                      {roleLabel[p.beneficiary_role]}
                      {p.beneficiary_name ? ` · ${p.beneficiary_name}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    #{p.installment_no}
                    {p.charge_due_date && (
                      <div className="text-xs text-brand-olive">
                        venc. {formatDateBR(p.charge_due_date)}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{p.pct}%</td>
                  <td className="px-4 py-3">{money(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      {canWrite && p.status === 'pendente' && (
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => mark(p.id, 'pago')}
                          className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                        >
                          Marcar repassado
                        </button>
                      )}
                      {canWrite && p.status === 'pago' && (
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => void reverse(p)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                        >
                          Estornar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
