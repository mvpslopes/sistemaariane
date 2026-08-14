import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, FileText, Printer, Pencil, Send, RefreshCw, CheckCircle2, Clock, Download, Copy, MessageCircle, Mail } from 'lucide-react';
import {
  getContract,
  getContracts,
  getClicksignStatus,
  getClicksignSignedPdfUrl,
  sendContractToClicksign,
  notifyClicksign,
  cancelClicksignEnvelope,
  updateContract,
  refreshContractsSignatureProgress,
  type Contract,
  type ClicksignTracking,
  type ClicksignSignerStatus,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import DetailSkeleton from '../../components/skeletons/DetailSkeleton';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, cmpNum, sortRows } from '../../hooks/useSortableTable';
import { formatDateBR, formatDateTimeBR } from '../../utils/dateTime';
import { useAppMobile } from '../../hooks/useAppMobile';
import { MobileCard } from '../../components/MobileCard';
import ContractForm from './ContractForm';
import ContractDocument, { ContractVerso } from './ContractDocument';
import { getContractPdfBase64 } from './printContractPdf';
import ContractSignatureProgress from '../../components/ContractSignatureProgress';
import {
  contractStatusDisplay,
  hasPendingSignatures,
  isAwaitingSignatures,
  isSignatureNotSent,
} from '../../utils/contractStatusDisplay';

const saleLabel = (type: string) => {
  const map: Record<string, string> = {
    inteiro: 'Inteiro',
    fracao: 'Fração',
    condominio: 'Condomínio',
  };
  return map[type] || type;
};

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type StatusFilter = 'all' | 'aguardando_assinatura' | 'finalizados' | 'cancelado';
type SortKey = 'animal' | 'type' | 'buyer' | 'value' | 'status';

const FINALIZED_STATUSES: Contract['status'][] = ['ativo', 'concluido'];

const STATUS_FILTER_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'aguardando_assinatura', label: 'Assinaturas pendentes' },
  { id: 'finalizados', label: 'Finalizados' },
  { id: 'cancelado', label: 'Cancelados' },
];

function statusSortRank(c: Contract) {
  if (isSignatureNotSent(c)) return 0.5;
  if (isAwaitingSignatures(c)) return 1;
  return STATUS_SORT_ORDER[c.status];
}

const STATUS_SORT_ORDER: Record<Contract['status'], number> = {
  rascunho: 0,
  aguardando_assinatura: 1,
  ativo: 2,
  concluido: 3,
  cancelado: 4,
};

function matchesStatusFilter(status: Contract['status'], filter: StatusFilter) {
  if (filter === 'all') return true;
  if (filter === 'finalizados') return FINALIZED_STATUSES.includes(status);
  return status === filter;
}

interface ContractsPageProps {
  initialAnimalId?: string | null;
}

export default function ContractsPage({ initialAnimalId = null }: ContractsPageProps) {
  const { canCreate, canUpdate } = useAuth();
  /** Operador pode compartilhar links; edição/envio administrativo continua só admin. */
  const canShareSignLinks = canCreate;
  const appMobile = useAppMobile();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [formOpen, setFormOpen] = useState(!!initialAnimalId);
  const [editId, setEditId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Contract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [sendingClicksign, setSendingClicksign] = useState(false);
  const [clicksignTracking, setClicksignTracking] = useState<ClicksignTracking | null>(null);
  const [loadingClicksign, setLoadingClicksign] = useState(false);
  const [notifyingClicksign, setNotifyingClicksign] = useState<string | null>(null);
  const [cancellingClicksign, setCancellingClicksign] = useState(false);
  const [signatureProgressLoading, setSignatureProgressLoading] = useState(false);
  const [notifyingContractId, setNotifyingContractId] = useState<string | null>(null);
  const preselectedAnimal = initialAnimalId;

  const needsSignatureProgress = (c: Contract) => isAwaitingSignatures(c);

  const refreshSignatureProgress = async (list: Contract[]) => {
    const ids = list.filter(needsSignatureProgress).map((c) => c.id);
    if (!ids.length) return;
    setSignatureProgressLoading(true);
    try {
      const { items } = await refreshContractsSignatureProgress(ids, canUpdate);
      if (!items.length) return;
      const byId = Object.fromEntries(items.map((i) => [i.contractId, i]));
      setItems((prev) =>
        prev.map((c) => {
          const p = byId[c.id];
          if (!p) return c;
          return {
            ...c,
            clicksign_signed_count: p.signedCount,
            clicksign_total_count: p.totalCount,
          };
        })
      );
    } catch {
      /* silencioso — cache local ou migration pendente */
    } finally {
      setSignatureProgressLoading(false);
    }
  };

  const clicksignStatusPt = (status?: string | null) => {
    const map: Record<string, string> = {
      draft: 'Rascunho',
      running: 'Em processo',
      closed: 'Finalizado',
      canceled: 'Cancelado',
      cancelled: 'Cancelado',
    };
    return (status && map[status]) || status || 'Enviado';
  };

  const load = async () => {
    setLoading(true);
    try {
      const list = await getContracts(preselectedAnimal ? { animalId: preselectedAnimal } : undefined);
      setItems(list);
      void refreshSignatureProgress(list);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar contratos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadClicksignTracking = async (id: string, silent = false) => {
    setLoadingClicksign(true);
    try {
      const tracking = await getClicksignStatus(id);
      setClicksignTracking(tracking);
      setDetail((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              clicksign_status: tracking.status,
              clicksign_signed_count: tracking.signedCount,
              clicksign_total_count: tracking.totalCount,
            }
          : prev
      );
      setItems((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                clicksign_status: tracking.status,
                clicksign_signed_count: tracking.signedCount,
                clicksign_total_count: tracking.totalCount,
              }
            : c
        )
      );
      if (!silent) success('Status das assinaturas atualizado');
    } catch (e: any) {
      if (!silent) toastError(e.message || 'Erro ao consultar assinaturas');
    } finally {
      setLoadingClicksign(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setClicksignTracking(null);
    try {
      const c = await getContract(id);
      setDetail(c);
      if (c.clicksign_envelope_id) {
        void loadClicksignTracking(id, true);
      }
    } catch (e: any) {
      toastError(e.message || 'Erro ao abrir contrato');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const onSendClicksign = async () => {
    if (!detail || !canUpdate) return;
    if (!detail.witness1_id || !detail.witness2_id) {
      toastError('Cadastre as duas testemunhas no contrato antes de enviar');
      return;
    }
    if (!detail.seller_email || !detail.buyer_email) {
      toastError('Vendedor e comprador precisam ter e-mail cadastrado');
      return;
    }
    if (!detail.witness1_email || !detail.witness2_email) {
      toastError('As testemunhas precisam ter e-mail cadastrado');
      return;
    }
    if (
      !confirm(
        'Enviar este contrato para assinatura na Clicksign?\n\nVendedor, comprador e as 2 testemunhas receberão o e-mail para assinar.'
      )
    ) {
      return;
    }
    setSendingClicksign(true);
    try {
      const pdfBase64 = await getContractPdfBase64(detail);
      const sent = await sendContractToClicksign(detail.id, pdfBase64);
      const warnings = sent.warnings || [];
      if (warnings.length) {
        toastError(
          `Enviado, mas faltam dados no cadastro (CPF/nascimento não serão pré-preenchidos):\n${warnings.join('\n')}`
        );
      } else {
        success('Contrato enviado à Clicksign. Os e-mails de assinatura foram disparados.');
      }
      await openDetail(detail.id);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao enviar para Clicksign');
    } finally {
      setSendingClicksign(false);
    }
  };

  const digitsOnly = (v?: string | null) => (v || '').replace(/\D/g, '');

  const whatsappDigits = (phone?: string | null, whatsapp?: string | null) => {
    let d = digitsOnly(whatsapp) || digitsOnly(phone);
    if (!d) return '';
    if (d.length <= 11) d = `55${d}`;
    return d;
  };

  const shareSignUrl = (s: ClicksignSignerStatus) => {
    if (s.signUrl) {
      if (s.signUrl.startsWith('http')) return s.signUrl;
      return `${window.location.origin}${s.signUrl.startsWith('/') ? '' : '/'}${s.signUrl}`;
    }
    if (!s.signerId) return null;
    return `${window.location.origin}/assinar/${encodeURIComponent(s.signerId)}`;
  };

  const signMessage = (s: ClicksignSignerStatus) => {
    const animal = detail?.animal_name || 'contrato';
    const link = shareSignUrl(s) || '';
    return `Olá ${s.name}! Segue o link para assinar o contrato de ${animal}:\n\n${link}`;
  };

  const onCopySignLink = async (s: ClicksignSignerStatus) => {
    const url = shareSignUrl(s);
    if (!url) {
      toastError('Link de assinatura indisponível');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      success('Link de assinatura copiado');
    } catch {
      toastError('Não foi possível copiar o link');
    }
  };

  const onWhatsAppSign = (s: ClicksignSignerStatus) => {
    const url = shareSignUrl(s);
    if (!url) {
      toastError('Link de assinatura indisponível');
      return;
    }
    const text = encodeURIComponent(signMessage(s));
    const phone = whatsappDigits(s.phone, s.whatsapp);
    const wa = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(wa, '_blank', 'noopener,noreferrer');
  };

  const onNotifyFromList = async (contractId: string) => {
    if (!canUpdate) return;
    setNotifyingContractId(contractId);
    try {
      const res = await notifyClicksign(contractId);
      success(res.message || 'Lembretes de assinatura reenviados');
      const target = items.find((c) => c.id === contractId);
      if (target) await refreshSignatureProgress([target]);
    } catch (e: any) {
      toastError(e.message || 'Erro ao reenviar lembretes');
    } finally {
      setNotifyingContractId(null);
    }
  };

  const onNotifyClicksign = async (signerId?: string | null) => {
    if (!detail || !canUpdate) return;
    const key = signerId || 'all';
    setNotifyingClicksign(key);
    try {
      const res = await notifyClicksign(detail.id, signerId);
      success(res.message || 'Notificação reenviada');
    } catch (e: any) {
      toastError(e.message || 'Erro ao reenviar notificação');
    } finally {
      setNotifyingClicksign(null);
    }
  };

  const onCancelClicksign = async () => {
    if (!detail || !canUpdate) return;
    if (
      !confirm(
        'Cancelar o envio à Clicksign?\n\nO link de assinatura atual deixará de funcionar e você poderá enviar o contrato novamente (com os dados atualizados de CPF/nascimento).'
      )
    ) {
      return;
    }
    setCancellingClicksign(true);
    try {
      const res = await cancelClicksignEnvelope(detail.id);
      success(res.message || 'Envio cancelado');
      setClicksignTracking(null);
      await openDetail(detail.id);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao cancelar envio');
    } finally {
      setCancellingClicksign(false);
    }
  };

  const onCancel = async () => {
    if (!detailId || !canUpdate) return;
    if (
      !confirm(
        'Cancelar este contrato?\n\nAs cobranças e repasses pendentes serão cancelados e deixarão de contar no painel.'
      )
    ) {
      return;
    }
    try {
      await updateContract(detailId, { status: 'cancelado' });
      success('Contrato cancelado · cobranças pendentes inativadas');
      await openDetail(detailId);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao cancelar');
    }
  };

  const onDownloadSignedPdf = async () => {
    if (!detail?.id) return;
    try {
      const res = await getClicksignSignedPdfUrl(detail.id);
      if (res.url) window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      toastError(e.message || 'Cópia assinada ainda não disponível');
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: items.length,
      aguardando_assinatura: 0,
      finalizados: 0,
      cancelado: 0,
    };
    items.forEach((c) => {
      if (c.status === 'aguardando_assinatura') counts.aguardando_assinatura += 1;
      if (FINALIZED_STATUSES.includes(c.status)) counts.finalizados += 1;
      if (c.status === 'cancelado') counts.cancelado += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((c) => {
      if (!matchesStatusFilter(c.status, statusFilter)) return false;
      if (!search) return true;
      return (
        (c.animal_name || '').toLowerCase().includes(search) ||
        (c.contract_number || '').toLowerCase().includes(search) ||
        (c.seller_name || '').toLowerCase().includes(search) ||
        (c.buyer_name || '').toLowerCase().includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'animal':
          return cmpStr(a.animal_name, b.animal_name) || cmpStr(a.contract_number, b.contract_number);
        case 'type':
          return cmpStr(a.sale_type, b.sale_type) || cmpNum(a.share_pct ?? 0, b.share_pct ?? 0);
        case 'buyer':
          return cmpStr(a.buyer_name, b.buyer_name);
        case 'value':
          return cmpNum(a.total_amount, b.total_amount);
        case 'status':
          return statusSortRank(a) - statusSortRank(b);
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          contratos
        </p>
        {canCreate && (
          <AppButton type="button" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Nova venda
          </AppButton>
        )}
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filtrar por animal, vendedor ou comprador..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <FilterPills
            options={STATUS_FILTER_OPTIONS.map((opt) => ({
              ...opt,
              count: statusCounts[opt.id],
            }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      {loading ? (
        <ListPageSkeleton variant={appMobile ? 'cards' : 'table'} />
      ) : appMobile ? (
        filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-brand-olive">Nenhum contrato encontrado</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const display = contractStatusDisplay(c);
              return (
              <li key={c.id}>
                <MobileCard onClick={() => openDetail(c.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-brand-dark-brown">{c.animal_name}</p>
                      {c.contract_number && (
                        <p className="text-xs text-brand-olive">{c.contract_number}</p>
                      )}
                      <p className="mt-1 text-xs text-brand-olive">
                        {saleLabel(c.sale_type)}
                        {c.share_pct != null && c.sale_type !== 'inteiro' ? ` (${c.share_pct}%)` : ''}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-brand-olive/80">
                        {c.seller_name} → {c.buyer_name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${display.tone}`}
                      >
                        {display.label}
                      </span>
                      {needsSignatureProgress(c) && (
                        <div className="mt-2 flex justify-end">
                          <ContractSignatureProgress
                            signedCount={c.clicksign_signed_count}
                            totalCount={c.clicksign_total_count}
                            compact
                            loading={signatureProgressLoading && c.clicksign_total_count == null}
                          />
                        </div>
                      )}
                      {isSignatureNotSent(c) && (
                        <p className="mt-1.5 max-w-[9rem] text-[10px] leading-snug text-slate-500">
                          Envie à Clicksign no detalhe do contrato
                        </p>
                      )}
                      <p className="mt-2 text-sm font-semibold text-brand-dark-brown">
                        {money(c.total_amount)}
                      </p>
                    </div>
                  </div>
                  {canUpdate && hasPendingSignatures(c) && (
                    <div className="mt-3 border-t border-brand-beige/60 pt-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onNotifyFromList(c.id);
                        }}
                        disabled={notifyingContractId === c.id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-beige bg-white px-3 py-2 text-xs font-medium text-brand-brown transition hover:bg-brand-off-white disabled:opacity-60"
                      >
                        {notifyingContractId === c.id ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Mail className="h-3.5 w-3.5" />
                        )}
                        Reenviar lembretes de assinatura
                      </button>
                    </div>
                  )}
                </MobileCard>
              </li>
            );})}
          </ul>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-brand-off-white text-brand-olive">
                <tr>
                  <SortTh
                    label="Nº / Animal"
                    column="animal"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="px-2 py-2.5 sm:px-3"
                  />
                  <SortTh
                    label="Tipo"
                    column="type"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="hidden px-2 py-2.5 xl:table-cell"
                  />
                  <SortTh
                    label="Comprador"
                    column="buyer"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="hidden px-2 py-2.5 lg:table-cell"
                  />
                  <SortTh
                    label="Valor"
                    column="value"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="px-2 py-2.5 sm:px-3"
                  />
                  <SortTh
                    label="Status"
                    column="status"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="px-2 py-2.5 sm:px-3"
                  />
                  <th className="px-1 py-2.5 font-medium sm:px-2" aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                      Nenhum contrato encontrado
                    </td>
                  </tr>
                )}
                {filtered.map((c) => {
                  const display = contractStatusDisplay(c, true);
                  const sale =
                    saleLabel(c.sale_type) +
                    (c.share_pct != null && c.sale_type !== 'inteiro' ? ` (${c.share_pct}%)` : '');
                  return (
                  <tr key={c.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                    <td className="px-2 py-2.5 font-medium text-brand-dark-brown sm:px-3">
                      <div className="truncate" title={c.animal_name || ''}>
                        {c.animal_name}
                      </div>
                      {c.contract_number && (
                        <div className="truncate text-xs font-normal text-brand-olive">{c.contract_number}</div>
                      )}
                      <div className="mt-0.5 truncate text-[11px] font-normal text-brand-olive xl:hidden" title={sale}>
                        {sale}
                      </div>
                      <div className="mt-0.5 truncate text-[11px] font-normal text-brand-olive lg:hidden" title={c.buyer_name || ''}>
                        {c.buyer_name}
                      </div>
                    </td>
                    <td className="hidden truncate px-2 py-2.5 text-brand-brown xl:table-cell" title={sale}>
                      {sale}
                    </td>
                    <td className="hidden truncate px-2 py-2.5 text-brand-brown lg:table-cell" title={c.buyer_name || ''}>
                      {c.buyer_name}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-brand-brown sm:px-3">
                      {money(c.total_amount)}
                    </td>
                    <td className="px-2 py-2.5 sm:px-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span
                          className={`inline-flex w-fit max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight sm:text-[11px] ${display.tone}`}
                          title={contractStatusDisplay(c).label}
                        >
                          {display.label}
                        </span>
                        {needsSignatureProgress(c) && (
                          <div className="flex min-w-0 flex-wrap items-center gap-1">
                            <ContractSignatureProgress
                              variant="table"
                              signedCount={c.clicksign_signed_count}
                              totalCount={c.clicksign_total_count}
                              loading={signatureProgressLoading && c.clicksign_total_count == null}
                            />
                            {canUpdate && hasPendingSignatures(c) && (
                              <button
                                type="button"
                                onClick={() => void onNotifyFromList(c.id)}
                                disabled={notifyingContractId === c.id}
                                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-beige/50 disabled:opacity-60"
                                title="Reenviar lembretes de assinatura"
                                aria-label="Reenviar lembretes de assinatura"
                              >
                                {notifyingContractId === c.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Mail className="h-3.5 w-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-2.5 text-right sm:px-2">
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => openDetail(c.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-beige/50"
                          title="Abrir"
                          aria-label="Abrir"
                        >
                          <FileText className="h-4 w-4" />
                        </button>
                        {canUpdate && c.status !== 'cancelado' && c.status !== 'concluido' && (
                          <button
                            type="button"
                            onClick={() => setEditId(c.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-beige/50"
                            title="Editar"
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova venda" subtitle="Contrato + cobranças" size="xl">
        <ContractForm
          animalId={preselectedAnimal}
          onClose={() => setFormOpen(false)}
          onSaved={(id) => {
            load();
            openDetail(id);
          }}
        />
      </Modal>

      <Modal
        open={!!editId}
        onClose={() => setEditId(null)}
        title="Editar contrato"
        subtitle="Atualizar dados da venda"
        size="xl"
      >
        {editId && (
          <ContractForm
            contractId={editId}
            onClose={() => setEditId(null)}
            onSaved={(id) => {
              setEditId(null);
              load();
              openDetail(id);
            }}
          />
        )}
      </Modal>

      <Modal
        open={!!detailId}
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        title="Contrato de venda"
        subtitle={detail?.animal_name || ''}
        size="xl"
      >
        {detailLoading || !detail ? (
          <DetailSkeleton />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Tipo" value={`${saleLabel(detail.sale_type)}${detail.share_pct && detail.sale_type !== 'inteiro' ? ` · ${detail.share_pct}%` : ''}`} />
              <Info
                label="Status"
                value={
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${contractStatusDisplay(detail).tone}`}
                  >
                    {contractStatusDisplay(detail).label}
                  </span>
                }
              />
              <Info label="Vendedor" value={detail.seller_name || '—'} />
              <Info label="Comprador" value={detail.buyer_name || '—'} />
              <Info label="Assessor" value={detail.assessor_name || '—'} />
              <Info label="Valor" value={money(detail.total_amount)} />
              <Info label="Pagamento" value={`${detail.payment_method.toUpperCase()} · ${detail.installments}x`} />
              <Info label="1º vencimento" value={detail.first_due_date} />
            </div>

            {(detail.clicksign_envelope_id ||
              (canUpdate && detail.status !== 'cancelado' && detail.status !== 'concluido')) && (
              <div className="rounded-xl border border-brand-beige bg-brand-off-white/60 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-brand-dark-brown">Assinatura digital</h4>
                    <p className="mt-0.5 text-xs text-brand-olive">
                      {detail.clicksign_envelope_id
                        ? 'Acompanhamento das assinaturas pela Clicksign.'
                        : 'Envia o PDF por e-mail para o vendedor, o comprador e as 2 testemunhas assinarem.'}
                    </p>
                  </div>
                  {detail.clicksign_envelope_id && (
                    <div className="flex flex-wrap items-center gap-2">
                      {canUpdate &&
                        (clicksignTracking?.status || detail.clicksign_status) === 'running' && (
                          <button
                            type="button"
                            disabled={!!notifyingClicksign}
                            onClick={() => onNotifyClicksign()}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-beige/40 disabled:opacity-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {notifyingClicksign === 'all' ? 'Reenviando...' : 'Reenviar a todos'}
                          </button>
                        )}
                      <button
                        type="button"
                        disabled={loadingClicksign}
                        onClick={() => loadClicksignTracking(detail.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-beige/40 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingClicksign ? 'animate-spin' : ''}`} />
                        {loadingClicksign ? 'Atualizando...' : 'Atualizar'}
                      </button>
                      {canUpdate &&
                        (clicksignTracking?.status || detail.clicksign_status) === 'running' && (
                          <button
                            type="button"
                            disabled={cancellingClicksign}
                            onClick={onCancelClicksign}
                            title="Cancela o envelope atual na Clicksign para permitir um novo envio (ex.: após corrigir CPF/data de nascimento no cadastro)"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {cancellingClicksign ? 'Cancelando...' : 'Cancelar envio'}
                          </button>
                        )}
                    </div>
                  )}
                </div>

                {detail.clicksign_envelope_id ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-brand-dark-brown">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                          (clicksignTracking?.status || detail.clicksign_status) === 'closed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : (clicksignTracking?.status || detail.clicksign_status) === 'canceled' ||
                                (clicksignTracking?.status || detail.clicksign_status) === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {clicksignTracking?.statusLabel ||
                          clicksignStatusPt(detail.clicksign_status)}
                      </span>
                      {clicksignTracking && (
                        <span className="text-sm font-medium">
                          {clicksignTracking.signedCount}/{clicksignTracking.totalCount} assinaturas
                        </span>
                      )}
                      {detail.clicksign_sent_at && (
                        <span className="text-xs text-brand-olive">
                          Enviado em {formatDateTimeBR(detail.clicksign_sent_at)}
                        </span>
                      )}
                    </div>

                    {loadingClicksign && !clicksignTracking ? (
                      <p className="text-xs text-brand-olive">Carregando acompanhamento...</p>
                    ) : clicksignTracking?.signers?.length ? (
                      <ul className="divide-y divide-brand-beige/80 rounded-xl border border-brand-beige bg-white">
                        {clicksignTracking.signers.map((s) => (
                          <li
                            key={`${s.role}-${s.email || s.name}-${s.signerId || ''}`}
                            className="flex items-start gap-3 px-3 py-2.5"
                          >
                            {s.signed ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : (
                              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                            )}
                            <div className="min-w-0 flex-1 space-y-2">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                <p className="text-sm font-medium text-brand-dark-brown">
                                  {s.label}
                                  <span className="font-normal text-brand-olive"> · {s.name}</span>
                                </p>
                                <span
                                  className={`text-xs font-semibold ${
                                    s.signed ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {s.signed && s.signedAt
                                    ? `Assinou em: ${formatDateBR(s.signedAt)}`
                                    : s.statusLabel}
                                </span>
                              </div>
                              {s.email && (
                                <p className="truncate text-xs text-brand-olive">{s.email}</p>
                              )}
                              {!s.signed && canShareSignLinks && (
                                <div className="space-y-1.5">
                                  <div className="flex flex-wrap gap-1.5">
                                    <button
                                      type="button"
                                      disabled={!shareSignUrl(s)}
                                      onClick={() => onCopySignLink(s)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-brand-beige bg-brand-off-white px-2.5 py-1 text-[11px] font-medium text-brand-brown hover:bg-brand-beige/50 disabled:opacity-40"
                                    >
                                      <Copy className="h-3 w-3" />
                                      Copiar link
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!shareSignUrl(s)}
                                      onClick={() => onWhatsAppSign(s)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                                    >
                                      <MessageCircle className="h-3 w-3" />
                                      WhatsApp
                                    </button>
                                    {canUpdate && (
                                      <button
                                        type="button"
                                        disabled={!s.signerId || !!notifyingClicksign}
                                        onClick={() => onNotifyClicksign(s.signerId)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-brand-beige bg-white px-2.5 py-1 text-[11px] font-medium text-brand-brown hover:bg-brand-beige/40 disabled:opacity-40"
                                      >
                                        <Mail className="h-3 w-3" />
                                        {notifyingClicksign === s.signerId
                                          ? 'Reenviando...'
                                          : 'Reenviar e-mail'}
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-brand-olive/80">
                                    O link abre a assinatura no sistema (widget Clicksign). Contratos
                                    enviados antes desta atualização podem exigir um novo envio.
                                  </p>
                                </div>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="space-y-1 text-sm text-brand-olive">
                        <li>Vendedor: {detail.seller_name || '—'}</li>
                        <li>Comprador: {detail.buyer_name || '—'}</li>
                        {detail.witness1_name && <li>Testemunha 1: {detail.witness1_name}</li>}
                        {detail.witness2_name && <li>Testemunha 2: {detail.witness2_name}</li>}
                      </ul>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={sendingClicksign}
                    onClick={onSendClicksign}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {sendingClicksign ? 'Enviando...' : 'Enviar para assinatura'}
                  </button>
                )}
              </div>
            )}

            {detail.charges && detail.charges.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-brand-dark-brown">Parcelas</h4>
                <div className="overflow-hidden rounded-xl border border-brand-beige">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-brand-off-white text-brand-olive">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.charges.map((ch) => (
                        <tr key={ch.id} className="border-t border-brand-beige/60">
                          <td className="px-3 py-2">{ch.installment_no}</td>
                          <td className="px-3 py-2">{ch.due_date}</td>
                          <td className="px-3 py-2">{money(ch.amount)}</td>
                          <td className="px-3 py-2 capitalize">{ch.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.payoutRules && detail.payoutRules.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-brand-dark-brown">Regras de repasse</h4>
                <ul className="space-y-1 text-sm text-brand-olive">
                  {detail.payoutRules.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-x-2 rounded-lg border border-brand-beige bg-brand-off-white/50 px-3 py-2">
                      <span className="font-medium text-brand-dark-brown">{r.label || r.beneficiary_name || r.beneficiary_role}</span>
                      <span>{r.pct}%</span>
                      {r.beneficiary_name && <span>· {r.beneficiary_name}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <ContractVerso contract={detail} />

            <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-beige px-4 py-2 text-sm hover:bg-brand-off-white"
              >
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </button>
              {(detail.clicksign_status === 'closed' ||
                clicksignTracking?.status === 'closed' ||
                clicksignTracking?.signedFileUrl) && (
                <button
                  type="button"
                  onClick={onDownloadSignedPdf}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                >
                  <Download className="h-4 w-4" /> Cópia assinada (PDF)
                </button>
              )}
              {canUpdate && detail.status !== 'cancelado' && (
                <button type="button" onClick={onCancel} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Cancelar contrato
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={printOpen && !!detail}
        onClose={() => setPrintOpen(false)}
        title="Pré-visualização do contrato"
        subtitle="Imprima ou salve em PDF com a logo da Ariane"
        size="2xl"
      >
        {detail && (
          <ContractDocument
            contract={detail}
            showActions
            onClose={() => setPrintOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-brand-olive">{label}</p>
      <div className="font-medium text-brand-dark-brown">{value}</div>
    </div>
  );
}
