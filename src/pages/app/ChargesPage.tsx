import { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Pencil, RotateCcw, Search, User } from 'lucide-react';
import {
  bulkUpdateCharges,
  getCharges,
  registerChargeCommission,
  updateCharge,
  type Charge,
  type ChargeCollector,
  type ChargeStatus,
} from '../../services/apiService';
import { CHARGE_COLLECTOR_SHORT } from '../../constants/chargeCollectors';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
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

const statusLabel: Record<ChargeStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
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

function storedStatus(c: Charge): ChargeStatus {
  return c.status === 'atrasado' ? 'pendente' : c.status;
}

function parseMoneyInput(value: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  return Number(normalized) || 0;
}

function formatMoneyInput(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function chargeCollector(c: Charge): ChargeCollector {
  return c.collector === 'seller' ? 'seller' : 'assessoria';
}

function sumAmount(list: Charge[]): number {
  return list.reduce((acc, c) => acc + (c.amount || 0), 0);
}

function ChargeKpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn' | 'ok';
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-card ${
        tone === 'warn' ? 'border-red-200' : tone === 'ok' ? 'border-emerald-200' : 'border-brand-beige'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${
          tone === 'warn' ? 'text-red-800' : tone === 'ok' ? 'text-emerald-800' : 'text-brand-dark-brown'
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-brand-olive">{hint}</p>}
    </div>
  );
}

export default function ChargesPage() {
  const { canUpdate, hasRole } = useAuth();
  const appMobile = useAppMobile();
  const isCliente = hasRole('cliente');
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collectorFilter, setCollectorFilter] = useState<CollectorFilter>(isCliente ? 'all' : 'assessoria');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [editCharge, setEditCharge] = useState<Charge | null>(null);
  const [editStatus, setEditStatus] = useState<ChargeStatus>('pendente');
  const [editCollector, setEditCollector] = useState<ChargeCollector>('assessoria');
  const [editNotes, setEditNotes] = useState('');
  const [commissionCharge, setCommissionCharge] = useState<Charge | null>(null);
  const [commissionAmount, setCommissionAmount] = useState('');
  const [commissionNotes, setCommissionNotes] = useState('');
  const [markChargePaid, setMarkChargePaid] = useState(true);
  const [confirmNotAssessoria, setConfirmNotAssessoria] = useState(false);
  const [confirmReversePayment, setConfirmReversePayment] = useState(false);

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

  const reversePayment = async (charge: Charge, skipConfirm = false) => {
    if (!canUpdate) return;
    if (
      !skipConfirm &&
      !confirm(
        `Estornar pagamento de ${charge.animal_name} — parcela ${charge.installment_no} (${money(charge.amount)})?`
      )
    ) {
      return;
    }
    setUpdatingId(charge.id);
    try {
      await updateCharge(charge.id, {
        status: 'pendente',
        notes: charge.notes
          ? `${charge.notes}\nEstorno de pagamento`
          : 'Estorno de pagamento',
      });
      success('Pagamento estornado');
      setEditCharge(null);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao estornar pagamento');
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (charge: Charge) => {
    setEditCharge(charge);
    setEditStatus(storedStatus(charge));
    setEditCollector(charge.collector === 'seller' ? 'seller' : 'assessoria');
    setEditNotes(charge.notes || '');
    setConfirmNotAssessoria(false);
    setConfirmReversePayment(false);
  };

  const applySpecialAction = async () => {
    if (!editCharge || !canUpdate) return;
    if (confirmReversePayment) {
      await reversePayment(editCharge, true);
      return;
    }
    if (confirmNotAssessoria) {
      await markNotAssessoria();
    }
  };

  const openCommission = (charge: Charge) => {
    const defaultAmount = charge.assessoria_commission_amount ?? 0;
    setCommissionCharge(charge);
    setCommissionAmount(defaultAmount > 0 ? formatMoneyInput(defaultAmount) : '');
    setCommissionNotes('Comissão repassada pelo vendedor');
    setMarkChargePaid(true);
  };

  const saveEdit = async () => {
    if (!editCharge || !canUpdate) return;
    setUpdatingId(editCharge.id);
    try {
      await updateCharge(editCharge.id, {
        status: editStatus,
        collector: editCollector,
        notes: editNotes.trim() || undefined,
      });
      success('Cobrança atualizada');
      setEditCharge(null);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao salvar cobrança');
    } finally {
      setUpdatingId(null);
    }
  };

  const saveCommission = async () => {
    if (!commissionCharge || !canUpdate) return;
    const amount = parseMoneyInput(commissionAmount);
    if (amount <= 0) {
      toastError('Informe o valor recebido pela assessoria');
      return;
    }
    setUpdatingId(commissionCharge.id);
    try {
      await registerChargeCommission(commissionCharge.id, {
        amount,
        notes: commissionNotes.trim() || undefined,
        markChargePaid,
      });
      success('Comissão registrada no sistema');
      setCommissionCharge(null);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao registrar comissão');
    } finally {
      setUpdatingId(null);
    }
  };

  const markNotAssessoria = async () => {
    if (!editCharge || !canUpdate) return;
    const notes =
      editNotes.trim() ||
      'Não cobrada pela assessoria — vendedor já acertou comissão diretamente';
    setUpdatingId(editCharge.id);
    try {
      await updateCharge(editCharge.id, {
        status: 'cancelado',
        collector: 'seller',
        notes,
      });
      success('Cobrança marcada como não cobrada pela assessoria');
      setEditCharge(null);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao salvar cobrança');
    } finally {
      setUpdatingId(null);
    }
  };

  const clientOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((c) => {
      if (c.client_id && c.client_name) map.set(c.client_id, c.client_name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [items]);

  const preFiltered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return items.filter((c) => {
      if (clientFilter && c.client_id !== clientFilter) return false;
      if (!search) return true;
      return (
        (c.animal_name || '').toLowerCase().includes(search) ||
        (c.client_name || '').toLowerCase().includes(search) ||
        String(c.installment_no).includes(search)
      );
    });
  }, [items, q, clientFilter]);

  const bulkTransferCount = useMemo(
    () =>
      clientFilter
        ? items.filter(
            (c) =>
              c.client_id === clientFilter &&
              chargeCollector(c) === 'assessoria' &&
              (c.status === 'pendente' || c.status === 'atrasado')
          ).length
        : 0,
    [items, clientFilter]
  );

  const bulkTransferToSeller = async () => {
    if (!clientFilter || !canUpdate || bulkTransferCount === 0) return;
    const clientName = clientOptions.find((o) => o.id === clientFilter)?.name || 'cliente';
    if (
      !confirm(
        `Passar ${bulkTransferCount} parcela(s) em aberto de ${clientName} para cobrança pelo vendedor?\n\nA assessoria não receberá mais essas parcelas.`
      )
    ) {
      return;
    }
    setBulkUpdating(true);
    try {
      const res = await bulkUpdateCharges({
        clientId: clientFilter,
        collector: 'seller',
        onlyAssessoria: true,
        onlyOpen: true,
      });
      success(`${res.updated} parcela(s) transferida(s) para o vendedor`);
      setCollectorFilter('all');
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao transferir cobranças');
    } finally {
      setBulkUpdating(false);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: preFiltered.length,
      pendente: 0,
      atrasado: 0,
      pago: 0,
      cancelado: 0,
    };
    preFiltered.forEach((i) => {
      if (counts[i.status] !== undefined) counts[i.status] += 1;
    });
    return counts;
  }, [preFiltered]);

  const collectorCounts = useMemo(() => {
    const counts: Record<CollectorFilter, number> = {
      all: preFiltered.length,
      assessoria: 0,
      seller: 0,
    };
    preFiltered.forEach((i) => {
      counts[chargeCollector(i)] += 1;
    });
    return counts;
  }, [preFiltered]);

  const filtered = useMemo(() => {
    let list = preFiltered.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (collectorFilter !== 'all' && chargeCollector(c) !== collectorFilter) return false;
      return true;
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
          return COLLECTOR_ORDER[chargeCollector(a)] - COLLECTOR_ORDER[chargeCollector(b)];
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return 0;
      }
    });
  }, [preFiltered, statusFilter, collectorFilter, sortKey, sortDir]);

  const dashboardStats = useMemo(() => {
    const open = filtered.filter((c) => c.status === 'pendente' || c.status === 'atrasado');
    const paid = filtered.filter((c) => c.status === 'pago');
    const overdue = filtered.filter((c) => c.status === 'atrasado');
    const assessoriaOpen = open.filter((c) => chargeCollector(c) === 'assessoria');
    return {
      count: filtered.length,
      openCount: open.length,
      openTotal: sumAmount(open),
      paidCount: paid.length,
      paidTotal: sumAmount(paid),
      overdueCount: overdue.length,
      overdueTotal: sumAmount(overdue),
      assessoriaOpenCount: assessoriaOpen.length,
      assessoriaOpenTotal: sumAmount(assessoriaOpen),
    };
  }, [filtered]);

  const selectedClientName = clientOptions.find((o) => o.id === clientFilter)?.name;
  const showCommissionColumn = collectorFilter !== 'assessoria';

  const renderActions = (c: Charge, collector: ChargeCollector) => {
    if (!canUpdate) return null;
    const commissionPending =
      collector === 'seller' &&
      c.assessoria_commission_status !== 'pago' &&
      c.assessoria_commission_status !== 'cancelado';

    return (
      <div className="inline-flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => openEdit(c)}
          disabled={updatingId === c.id}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-beige/50 disabled:opacity-50"
          title="Editar situação"
          aria-label="Editar situação"
        >
          <Pencil className="h-4 w-4" />
        </button>
        {collector === 'assessoria' && c.status !== 'pago' && c.status !== 'cancelado' && (
          <button
            type="button"
            disabled={updatingId === c.id}
            onClick={() => mark(c.id, 'pago')}
            className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            title="Marcar como pago"
          >
            Pagar
          </button>
        )}
        {commissionPending && (
          <button
            type="button"
            disabled={updatingId === c.id}
            onClick={() => openCommission(c)}
            className="inline-flex h-8 shrink-0 items-center rounded-lg px-2 text-[11px] font-medium text-brand-gold hover:bg-brand-gold/10 disabled:opacity-50"
            title="Registrar comissão"
          >
            Comissão
          </button>
        )}
        {c.status === 'pago' && (
          <button
            type="button"
            disabled={updatingId === c.id}
            onClick={() => void reversePayment(c)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
            title="Estornar pagamento"
            aria-label="Estornar pagamento"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ChargeKpi
          label={selectedClientName ? `Parcelas · ${selectedClientName}` : 'Parcelas no filtro'}
          value={String(dashboardStats.count)}
          hint={
            filtered.length !== items.length
              ? `${filtered.length} de ${items.length} no total`
              : `${items.length} no sistema`
          }
        />
        <ChargeKpi
          label="Em aberto"
          value={money(dashboardStats.openTotal)}
          hint={`${dashboardStats.openCount} parcela(s)`}
        />
        <ChargeKpi
          label="Pagas"
          value={money(dashboardStats.paidTotal)}
          hint={`${dashboardStats.paidCount} parcela(s)`}
          tone="ok"
        />
        <ChargeKpi
          label="Atrasadas"
          value={money(dashboardStats.overdueTotal)}
          hint={`${dashboardStats.overdueCount} parcela(s)`}
          tone={dashboardStats.overdueCount > 0 ? 'warn' : undefined}
        />
      </div>

      {!isCliente && dashboardStats.assessoriaOpenCount > 0 && (
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{money(dashboardStats.assessoriaOpenTotal)}</span>{' '}
          em aberto pela assessoria ({dashboardStats.assessoriaOpenCount} parcela
          {dashboardStats.assessoriaOpenCount !== 1 ? 's' : ''})
        </p>
      )}

      {!isCliente && clientFilter && bulkTransferCount > 0 && canUpdate && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-gold/40 bg-brand-gold/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-brand-dark-brown">
              {selectedClientName} — {bulkTransferCount} parcela{bulkTransferCount !== 1 ? 's' : ''} ainda cobrada
              {bulkTransferCount !== 1 ? 's' : ''} pela assessoria
            </p>
            <p className="mt-0.5 text-xs text-brand-olive">
              Transfere todas de uma vez para o vendedor (parcelas em aberto). Parcelas já pagas não são alteradas.
            </p>
          </div>
          <AppButton
            variant="secondary"
            loading={bulkUpdating}
            onClick={() => void bulkTransferToSeller()}
            className="inline-flex shrink-0 items-center gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            Passar todas para o vendedor
          </AppButton>
        </div>
      )}

      <ListTableToolbar
        search={
          <div className={`grid gap-2 ${!isCliente ? 'md:grid-cols-2' : ''}`}>
            {!isCliente && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-8 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
                >
                  <option value="">Todos os clientes</option>
                  {clientOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar por animal, cliente ou parcela..."
                className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
              />
            </div>
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
                        {collector === 'seller' && c.assessoria_commission_amount != null && (
                          <p className="mt-1 text-[11px] text-brand-olive">
                            Comissão assessoria: {money(c.assessoria_commission_amount)}
                            {c.assessoria_commission_status === 'pago' ? ' · recebida' : ''}
                          </p>
                        )}
                        {c.notes && (
                          <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{c.notes}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusTone[c.status] || statusTone.pendente}`}
                        >
                          {statusLabel[c.status] || c.status}
                        </span>
                        <p className="mt-2 text-base font-semibold text-brand-dark-brown">{money(c.amount)}</p>
                        <div className="mt-2">{renderActions(c, collector)}</div>
                      </div>
                    </div>
                  </MobileCard>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div className="rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-brand-off-white text-brand-olive">
                <tr>
                  <SortTh label="Animal" column="animal" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Cliente" column="client" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                  <SortTh label="Parcela" column="installment" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Vencimento" column="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Valor parcela" column="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  {showCommissionColumn && (
                    <th className="px-4 py-3 font-medium">Comissão assess.</th>
                  )}
                  <SortTh label="Cobrada por" column="collector" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="sticky right-0 z-20 w-24 min-w-24 bg-brand-off-white px-2 py-3 pr-3 text-right font-medium shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={showCommissionColumn ? 9 : 8} className="px-4 py-10 text-center text-brand-olive">
                      Nenhuma cobrança encontrada
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const collector = c.collector === 'seller' ? 'seller' : 'assessoria';
                  return (
                    <tr key={c.id} className="group border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                      <td className="px-4 py-3 font-medium text-brand-dark-brown">
                        <div>{c.animal_name}</div>
                        {c.notes && (
                          <p className="mt-0.5 line-clamp-1 text-[11px] font-normal text-slate-500" title={c.notes}>
                            {c.notes}
                          </p>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{c.client_name}</td>
                      <td className="px-4 py-3 text-brand-brown">
                        {c.installment_no} · {c.payment_method.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-brand-brown">{formatDateBR(c.due_date)}</td>
                      <td className="px-4 py-3 text-brand-brown">{money(c.amount)}</td>
                      {showCommissionColumn && (
                        <td className="px-4 py-3 text-brand-brown">
                          {c.assessoria_commission_amount != null ? (
                            <div>
                              <span>{money(c.assessoria_commission_amount)}</span>
                              {c.assessoria_commission_status === 'pago' && (
                                <span className="ml-1 text-[11px] text-emerald-700">· recebida</span>
                              )}
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      )}
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
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[c.status] || statusTone.pendente}`}>
                          {statusLabel[c.status] || c.status}
                        </span>
                      </td>
                      <td className="sticky right-0 z-10 w-24 min-w-24 whitespace-nowrap bg-white px-2 py-3 pr-3 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-brand-off-white/70">
                        {renderActions(c, collector)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={!!editCharge}
        onClose={() => {
          setEditCharge(null);
          setConfirmNotAssessoria(false);
          setConfirmReversePayment(false);
        }}
        title="Editar cobrança"
        subtitle={editCharge ? `${editCharge.animal_name} · parcela ${editCharge.installment_no}` : undefined}
        size="md"
      >
        {editCharge && (
          <div className="space-y-4">
            <p className="text-sm text-brand-olive">
              Valor da parcela: <span className="font-semibold text-brand-dark-brown">{money(editCharge.amount)}</span>
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-dark-brown">Situação de pagamento</span>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as ChargeStatus)}
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
              >
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="cancelado">Cancelado / não cobrar</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-dark-brown">Cobrada por</span>
              <select
                value={editCollector}
                onChange={(e) => setEditCollector(e.target.value as ChargeCollector)}
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
              >
                <option value="assessoria">Assessoria</option>
                <option value="seller">Vendedor</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-dark-brown">Observações</span>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Ex.: vendedor já acertou comissão diretamente"
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
              />
            </label>
            <div className="space-y-3 rounded-xl border border-brand-beige bg-brand-off-white/40 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-olive">
                Ações especiais
              </p>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-beige bg-white p-3 transition hover:bg-brand-off-white/60">
                <input
                  type="checkbox"
                  checked={confirmNotAssessoria}
                  onChange={(e) => {
                    setConfirmNotAssessoria(e.target.checked);
                    if (e.target.checked) setConfirmReversePayment(false);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-brand-dark-brown">
                    Não cobrar pela assessoria
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-brand-olive">
                    Marca como cancelada e registra que o vendedor já acertou a comissão.
                  </span>
                </span>
              </label>
              {editCharge.status === 'pago' && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200/70 bg-white p-3 transition hover:bg-red-50/40">
                  <input
                    type="checkbox"
                    checked={confirmReversePayment}
                    onChange={(e) => {
                      setConfirmReversePayment(e.target.checked);
                      if (e.target.checked) setConfirmNotAssessoria(false);
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-red-300 text-red-600 focus:ring-red-200"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-red-800">Estornar pagamento</span>
                    <span className="mt-0.5 block text-xs leading-snug text-brand-olive">
                      Volta a parcela para pendente e reverte os repasses vinculados.
                    </span>
                  </span>
                </label>
              )}
              {(confirmNotAssessoria || confirmReversePayment) && (
                <AppButton
                  variant="danger"
                  className="w-full"
                  onClick={() => void applySpecialAction()}
                  disabled={updatingId === editCharge.id}
                >
                  {confirmReversePayment ? 'Confirmar estorno' : 'Confirmar: não cobrar pela assessoria'}
                </AppButton>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <AppButton variant="secondary" onClick={() => setEditCharge(null)}>
                Cancelar
              </AppButton>
              <AppButton onClick={() => void saveEdit()} disabled={updatingId === editCharge.id}>
                Salvar
              </AppButton>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!commissionCharge}
        onClose={() => setCommissionCharge(null)}
        title="Registrar comissão recebida"
        subtitle={
          commissionCharge
            ? `${commissionCharge.animal_name} · parcela ${commissionCharge.installment_no}`
            : undefined
        }
        size="md"
      >
        {commissionCharge && (
          <div className="space-y-4">
            <p className="text-sm text-brand-olive">
              Parcela de {money(commissionCharge.amount)} cobrada pelo vendedor.
              Informe quanto a assessoria recebeu de comissão nesta parcela.
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-dark-brown">Valor recebido pela assessoria</span>
              <input
                value={commissionAmount}
                onChange={(e) => setCommissionAmount(e.target.value)}
                inputMode="decimal"
                placeholder="3.000,00"
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-brand-dark-brown">Observações</span>
              <textarea
                value={commissionNotes}
                onChange={(e) => setCommissionNotes(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm outline-none focus:border-brand-olive"
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-brand-brown">
              <input
                type="checkbox"
                checked={markChargePaid}
                onChange={(e) => setMarkChargePaid(e.target.checked)}
                className="mt-1"
              />
              <span>
                Considerar a parcela como quitada pelo vendedor (recomendado quando o comprador já pagou ao vendedor)
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <AppButton variant="secondary" onClick={() => setCommissionCharge(null)}>
                Cancelar
              </AppButton>
              <AppButton onClick={() => void saveCommission()} disabled={updatingId === commissionCharge.id}>
                Registrar
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
