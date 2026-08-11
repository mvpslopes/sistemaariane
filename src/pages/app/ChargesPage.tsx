import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { getCharges, updateCharge, type Charge, type ChargeStatus } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, cmpNum, sortRows } from '../../hooks/useSortableTable';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusTone: Record<string, string> = {
  pendente: 'bg-brand-beige/60 text-brand-olive',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-brand-beige/60 text-brand-olive',
};

type StatusFilter = 'all' | ChargeStatus;
type SortKey = 'animal' | 'client' | 'installment' | 'dueDate' | 'amount' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'atrasado', label: 'Atrasadas' },
  { id: 'pago', label: 'Pagas' },
  { id: 'cancelado', label: 'Canceladas' },
];

const STATUS_ORDER: Record<ChargeStatus, number> = {
  atrasado: 0,
  pendente: 1,
  pago: 2,
  cancelado: 3,
};

export default function ChargesPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getCharges());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar cobranças');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id: string, next: ChargeStatus) => {
    if (!canWrite) return;
    setUpdatingId(id);
    try {
      await updateCharge(id, { status: next });
      success(next === 'pago' ? 'Cobrança marcada como paga' : 'Status atualizado');
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: items.length,
      pendente: 0,
      atrasado: 0,
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
    let list = items.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!search) return true;
      return (
        (c.animal_name || '').toLowerCase().includes(search) ||
        (c.client_name || '').toLowerCase().includes(search) ||
        String(c.installment_no).includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'animal':
          return cmpStr(a.animal_name, b.animal_name);
        case 'client':
          return cmpStr(a.client_name, b.client_name);
        case 'installment':
          return cmpNum(a.installment_no, b.installment_no);
        case 'dueDate':
          return cmpStr(a.due_date, b.due_date);
        case 'amount':
          return cmpNum(a.amount, b.amount);
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, sortKey, sortDir]);

  const pending = items.filter((i) => i.status === 'pendente' || i.status === 'atrasado').length;
  const paid = items.filter((i) => i.status === 'pago').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          cobranças ·{' '}
          <span className="font-semibold text-brand-dark-brown">{pending}</span> em aberto ·{' '}
          <span className="font-semibold text-brand-dark-brown">{paid}</span> pagas
        </p>
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por animal, cliente ou parcela..."
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
        <Loading message="Carregando cobranças..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh label="Animal" column="animal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Cliente" column="client" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Parcela" column="installment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Vencimento" column="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Valor" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                  <td className="px-4 py-3 font-medium text-brand-dark-brown">{c.animal_name}</td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{c.client_name}</td>
                  <td className="px-4 py-3 text-brand-brown">
                    {c.installment_no} · {c.payment_method.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-brand-brown">{c.due_date}</td>
                  <td className="px-4 py-3 text-brand-brown">{money(c.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusTone[c.status] || statusTone.pendente}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && c.status !== 'pago' && c.status !== 'cancelado' && (
                      <button
                        type="button"
                        disabled={updatingId === c.id}
                        onClick={() => mark(c.id, 'pago')}
                        className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Marcar pago
                      </button>
                    )}
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
