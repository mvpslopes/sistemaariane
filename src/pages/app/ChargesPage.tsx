import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  getCharges,
  updateCharge,
  type Charge,
  type ChargeCollector,
  type ChargeStatus,
} from '../../services/apiService';
import { CHARGE_COLLECTOR_SHORT } from '../../constants/chargeCollectors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, cmpNum, sortRows } from '../../hooks/useSortableTable';
import { useAppMobile } from '../../hooks/useAppMobile';
import { formatDateBR } from '../../utils/dateTime';
import { MobileCard } from '../../components/MobileCard';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusTone: Record<string, string> = {
  pendente: 'bg-brand-beige/60 text-brand-olive',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-brand-beige/60 text-brand-olive',
};

const collectorTone: Record<ChargeCollector, string> = {
  assessoria: 'bg-brand-beige/50 text-brand-dark-brown',
  seller: 'bg-slate-100 text-slate-700',
};

type StatusFilter = 'all' | ChargeStatus;
type CollectorFilter = 'all' | ChargeCollector;
type SortKey = 'animal' | 'client' | 'installment' | 'dueDate' | 'amount' | 'collector' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'pendente', label: 'Pendentes' },
  { id: 'atrasado', label: 'Atrasadas' },
  { id: 'pago', label: 'Pagas' },
  { id: 'cancelado', label: 'Canceladas' },
];

const COLLECTOR_FILTERS: { id: CollectorFilter; label: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'assessoria', label: 'Assessoria' },
  { id: 'seller', label: 'Vendedor' },
];

const STATUS_ORDER: Record<ChargeStatus, number> = {
  atrasado: 0,
  pendente: 1,
  pago: 2,
  cancelado: 3,
};

const COLLECTOR_ORDER: Record<ChargeCollector, number> = {
  assessoria: 0,
  seller: 1,
};

export default function ChargesPage() {
  const { canUpdate, hasRole } = useAuth();
  const appMobile = useAppMobile();
  const isCliente = hasRole('cliente');
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collectorFilter, setCollectorFilter] = useState<CollectorFilter>('all');
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
    if (!canUpdate) return;
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

  const setCollector = async (id: string, collector: ChargeCollector) => {
    if (!canUpdate) return;
    setUpdatingId(id);
    try {
      await updateCharge(id, { collector });
      success('Destinação da cobrança atualizada');
      setItems((prev) => prev.map((c) => (c.id === id ? { ...c, collector } : c)));
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar destinação');
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

  const collectorCounts = useMemo(() => {
    const counts: Record<CollectorFilter, number> = {
      all: items.length,
      assessoria: 0,
      seller: 0,
    };
    items.forEach((i) => {
      const key = i.collector === 'seller' ? 'seller' : 'assessoria';
      counts[key] += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (collectorFilter !== 'all') {
        const col = c.collector === 'seller' ? 'seller' : 'assessoria';
        if (col !== collectorFilter) return false;
      }
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
        case 'collector':
          return (
            COLLECTOR_ORDER[a.collector === 'seller' ? 'seller' : 'assessoria'] -
            COLLECTOR_ORDER[b.collector === 'seller' ? 'seller' : 'assessoria']
          );
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, collectorFilter, sortKey, sortDir]);

  const assessoriaItems = items.filter((i) => (i.collector === 'seller' ? 'seller' : 'assessoria') === 'assessoria');
  const pending = assessoriaItems.filter((i) => i.status === 'pendente' || i.status === 'atrasado').length;
  const paid = assessoriaItems.filter((i) => i.status === 'pago').length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          cobranças
          {!isCliente && (
            <>
              {' '}
              · <span className="font-semibold text-brand-dark-brown">{pending}</span> da assessoria em aberto ·{' '}
              <span className="font-semibold text-brand-dark-brown">{paid}</span> da assessoria pagas
            </>
          )}
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
          <div className="flex flex-col gap-2">
            <FilterPills
              options={STATUS_FILTERS.map((opt) => ({ ...opt, count: statusCounts[opt.id] }))}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            {!isCliente && (
              <FilterPills
                options={COLLECTOR_FILTERS.map((opt) => ({ ...opt, count: collectorCounts[opt.id] }))}
                value={collectorFilter}
                onChange={setCollectorFilter}
              />
            )}
          </div>
        }
      />

      {loading ? (
        <ListPageSkeleton variant={appMobile ? 'cards' : 'table'} />
      ) : appMobile ? (
        filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-brand-olive">Nenhuma cobrança encontrada</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const collector = c.collector === 'seller' ? 'seller' : 'assessoria';
              return (
                <li key={c.id}>
                  <MobileCard>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-brand-dark-brown">{c.animal_name}</p>
                        <p className="mt-0.5 text-xs text-brand-olive">
                          Parcela {c.installment_no} · {c.payment_method.toUpperCase()}
                        </p>
                        <p className="mt-0.5 text-xs text-brand-olive">Venc. {formatDateBR(c.due_date)}</p>
                        <span
                          className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${collectorTone[collector]}`}
                        >
                          {CHARGE_COLLECTOR_SHORT[collector]}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone[c.status] || statusTone.pendente}`}
                        >
                          {c.status}
                        </span>
                        <p className="mt-2 text-base font-semibold text-brand-dark-brown">{money(c.amount)}</p>
                      </div>
                    </div>
                  </MobileCard>
                </li>
              );
            })}
          </ul>
        )
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
                <SortTh label="Cobrada por" column="collector" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-brand-olive">
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              )}
              {filtered.map((c) => {
                const collector = c.collector === 'seller' ? 'seller' : 'assessoria';
                return (
                  <tr key={c.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                    <td className="px-4 py-3 font-medium text-brand-dark-brown">{c.animal_name}</td>
                    <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{c.client_name}</td>
                    <td className="px-4 py-3 text-brand-brown">
                      {c.installment_no} · {c.payment_method.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-brand-brown">{formatDateBR(c.due_date)}</td>
                    <td className="px-4 py-3 text-brand-brown">{money(c.amount)}</td>
                    <td className="px-4 py-3">
                      {canUpdate ? (
                        <select
                          disabled={updatingId === c.id}
                          value={collector}
                          onChange={(e) => setCollector(c.id, e.target.value as ChargeCollector)}
                          className="rounded-lg border border-brand-beige bg-white px-2 py-1 text-xs text-brand-dark-brown outline-none focus:border-brand-olive"
                        >
                          <option value="assessoria">{CHARGE_COLLECTOR_SHORT.assessoria}</option>
                          <option value="seller">{CHARGE_COLLECTOR_SHORT.seller}</option>
                        </select>
                      ) : (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${collectorTone[collector]}`}>
                          {CHARGE_COLLECTOR_SHORT[collector]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusTone[c.status] || statusTone.pendente}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canUpdate &&
                        collector === 'assessoria' &&
                        c.status !== 'pago' &&
                        c.status !== 'cancelado' && (
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
