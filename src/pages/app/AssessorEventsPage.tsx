import { useCallback, useEffect, useState } from 'react';
import { Gavel, TrendingUp, Wallet, Clock, CheckCircle2 } from 'lucide-react';
import {
  getAuctions,
  getAssessorAuctionFinance,
  type AssessorAuctionFinance,
  type Auction,
} from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import AppButton from '../../components/AppButton';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import DetailSkeleton from '../../components/skeletons/DetailSkeleton';
import { formatDateBR } from '../../utils/dateTime';
import { assessorPortalLabels } from '../../constants/assessorPortalLabels';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

const contractStatusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
};

const payoutStatusLabel: Record<string, string> = {
  aguardando: 'Aguardando cobrança',
  pendente: 'Pendente',
  pago: 'Repassado',
  cancelado: 'Cancelado',
};

export default function AssessorEventsPage() {
  const { error: toastError } = useToast();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AssessorAuctionFinance | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getAuctions());
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      setDetail(await getAssessorAuctionFinance(id));
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao abrir evento');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return <ListPageSkeleton variant="cards" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        {items.length} evento{items.length === 1 ? '' : 's'} · {assessorPortalLabels.eventsPageSubtitle}
      </p>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-brand-beige bg-white px-6 py-12 text-center shadow-card">
          <Gavel className="mx-auto h-10 w-10 text-brand-olive/50" />
          <p className="mt-3 font-medium text-brand-dark-brown">{assessorPortalLabels.emptyEvents}</p>
          <p className="mt-1 text-sm text-brand-olive">{assessorPortalLabels.emptyEventsHint}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => openDetail(event.id)}
              className="rounded-2xl border border-brand-beige bg-white p-4 text-left shadow-card transition hover:border-brand-olive/40 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-off-white text-brand-brown">
                  <Gavel className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-brand-dark-brown">{event.name}</p>
                  <p className="mt-0.5 text-xs text-brand-olive">
                    {event.auction_date ? formatDateBR(event.auction_date) : 'Sem data'}
                    {event.location ? ` · ${event.location}` : ''}
                  </p>
                  <p className="mt-2 text-xs text-brand-olive">
                    {statusLabel[event.status] || event.status}
                    {' · '}
                    {event.contracts_count ?? 0} venda{(event.contracts_count ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-brand-beige/70 pt-3 text-xs">
                <div>
                  <p className="text-brand-olive">Vendas</p>
                  <p className="font-semibold text-brand-dark-brown">{money(event.sales_total ?? 0)}</p>
                </div>
                <div>
                  <p className="text-brand-olive">Comissão est.</p>
                  <p className="font-semibold text-brand-dark-brown">
                    {money(event.commission_estimated ?? 0)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <Modal
        open={!!detailId}
        title={detail?.auction_name || 'Evento'}
        subtitle="Suas vendas e comissões neste leilão"
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        size="2xl"
      >
        {detailLoading || !detail ? (
          <DetailSkeleton />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 text-sm text-brand-olive">
              <span>{detail.auction_date ? formatDateBR(detail.auction_date) : 'Sem data'}</span>
              {detail.location && <span>· {detail.location}</span>}
              <span className="rounded-full bg-brand-off-white px-2 py-0.5 text-xs">
                {statusLabel[detail.auction_status] || detail.auction_status}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={TrendingUp}
                label="Vendas"
                value={money(detail.sales_total)}
                hint={`${detail.contracts_count} contrato${detail.contracts_count === 1 ? '' : 's'}`}
              />
              <KpiCard
                icon={Wallet}
                label="Comissão estimada"
                value={money(detail.commission_estimated)}
              />
              <KpiCard
                icon={Clock}
                label="A receber"
                value={money(detail.commission_pending + detail.commission_waiting)}
                hint={
                  detail.commission_waiting > 0
                    ? `${money(detail.commission_waiting)} aguardando cobrança`
                    : undefined
                }
              />
              <KpiCard
                icon={CheckCircle2}
                label="Repassado"
                value={money(detail.commission_paid)}
              />
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-brand-dark-brown">Suas vendas</h3>
              <div className="overflow-hidden rounded-xl border border-brand-beige">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-brand-off-white text-brand-olive">
                    <tr>
                      <th className="px-3 py-2 font-medium">Animal</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">Comprador</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">Comissão</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.contracts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-brand-olive">
                          Nenhuma venda neste evento
                        </td>
                      </tr>
                    )}
                    {detail.contracts.map((c) => (
                      <tr key={c.id} className="border-t border-brand-beige/70">
                        <td className="px-3 py-2">
                          <p className="font-medium">{c.animal_name || '—'}</p>
                          {c.lot_number && (
                            <p className="text-xs text-brand-olive">Lote {c.lot_number}</p>
                          )}
                        </td>
                        <td className="hidden px-3 py-2 sm:table-cell">{c.buyer_name || '—'}</td>
                        <td className="px-3 py-2">{money(c.total_amount)}</td>
                        <td className="hidden px-3 py-2 md:table-cell">
                          {money(c.commission_amount)}
                          {c.commission_pct > 0 && (
                            <span className="ml-1 text-xs text-brand-olive">({c.commission_pct}%)</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {contractStatusLabel[c.status] || c.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-brand-dark-brown">Repasses de comissão</h3>
              <div className="overflow-hidden rounded-xl border border-brand-beige">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-brand-off-white text-brand-olive">
                    <tr>
                      <th className="px-3 py-2 font-medium">Animal</th>
                      <th className="px-3 py-2 font-medium">Parcela</th>
                      <th className="hidden px-3 py-2 font-medium sm:table-cell">Vencimento</th>
                      <th className="px-3 py-2 font-medium">Valor</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payouts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-8 text-center text-brand-olive">
                          Nenhum repasse gerado ainda
                        </td>
                      </tr>
                    )}
                    {detail.payouts.map((p) => (
                      <tr key={p.id} className="border-t border-brand-beige/70">
                        <td className="px-3 py-2">{p.animal_name || '—'}</td>
                        <td className="px-3 py-2">{p.installment_no}ª</td>
                        <td className="hidden px-3 py-2 sm:table-cell">
                          {p.charge_due_date ? formatDateBR(p.charge_due_date) : '—'}
                        </td>
                        <td className="px-3 py-2">{money(p.amount)}</td>
                        <td className="px-3 py-2 text-xs">
                          {payoutStatusLabel[p.status] || p.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="flex justify-end">
              <AppButton variant="secondary" onClick={() => setDetailId(null)}>
                Fechar
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-brand-beige bg-white p-3 shadow-sm">
      <div className="flex items-center gap-2 text-brand-olive">
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-brand-dark-brown">{value}</p>
      {hint && <p className="mt-1 text-xs text-brand-olive">{hint}</p>}
    </div>
  );
}
