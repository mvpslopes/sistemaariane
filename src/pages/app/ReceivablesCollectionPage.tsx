import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, MessageCircle, Search } from 'lucide-react';
import {
  createChargeCollectionEvent,
  getClients,
  getReceivablesAnalytical,
  type Client,
  type ReceivablesAnalyticalClient,
  type ReceivablesAnalyticalItem,
  type ReceivablesAnalyticalReport,
  type ReceivablesAnalyticalStatus,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import CollectionHistoryModal from '../../components/CollectionHistoryModal';
import ReceivablesWhatsappTemplateEditor from '../../components/ReceivablesWhatsappTemplateEditor';
import { useReceivablesWhatsappTemplate } from '../../hooks/useReceivablesWhatsappTemplate';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import { CHARGE_COLLECTOR_SHORT } from '../../constants/chargeCollectors';
import { cobrarButtonClassName } from '../../constants/collectionActions';
import { formatDateBR } from '../../utils/dateTime';
import { applyReceivablesWhatsappTemplate, whatsAppHref } from '../../utils/receivablesWhatsapp';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_OPTIONS: { id: ReceivablesAnalyticalStatus; label: string }[] = [
  { id: 'overdue_and_upcoming', label: 'Vencidos e a vencer' },
  { id: 'overdue', label: 'Vencidos' },
  { id: 'upcoming', label: 'A vencer' },
  { id: 'cancelled', label: 'Cancelados' },
  { id: 'paid', label: 'Pagos' },
  { id: 'all', label: 'Todos' },
];

const statusTone: Record<string, string> = {
  pendente: 'bg-brand-beige/60 text-brand-olive',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-slate-100 text-slate-600',
};

function yearBounds() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

type WaTarget = {
  phone: string | null | undefined;
  charge: ReceivablesAnalyticalItem;
  client: ReceivablesAnalyticalClient;
};

export default function ReceivablesCollectionPage() {
  const { success, error: toastError } = useToast();
  const { canUpdate } = useAuth();
  const { settings, resolveTemplate, saveSettings } = useReceivablesWhatsappTemplate(!!canUpdate);
  const bounds = yearBounds();
  const [status, setStatus] = useState<ReceivablesAnalyticalStatus>('overdue_and_upcoming');
  const [from, setFrom] = useState(bounds.from);
  const [to, setTo] = useState(bounds.to);
  const [clientId, setClientId] = useState('');
  const [q, setQ] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [report, setReport] = useState<ReceivablesAnalyticalReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [waTarget, setWaTarget] = useState<WaTarget | null>(null);
  const [waMessage, setWaMessage] = useState('');
  const [historyCharge, setHistoryCharge] = useState<{
    charge: ReceivablesAnalyticalItem;
    clientName: string;
  } | null>(null);

  useEffect(() => {
    getClients(undefined, 'buyer')
      .then(setClients)
      .catch(() => {});
  }, []);

  const search = async () => {
    setLoading(true);
    setSearched(true);
    try {
      setReport(
        await getReceivablesAnalytical({
          status,
          from: from || undefined,
          to: to || undefined,
          clientId: clientId || undefined,
          q: q.trim() || undefined,
        })
      );
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao gerar relatório');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (client: ReceivablesAnalyticalClient, charge: ReceivablesAnalyticalItem) => {
    setWaTarget({ phone: client.whatsapp || client.phone, charge, client });
    setWaMessage(
      applyReceivablesWhatsappTemplate(resolveTemplate(), {
        clientName: client.clientName,
        overdueAmount: charge.amount,
        chargesCount: 1,
        oldestDue: charge.dueDate,
        animalName: charge.animalName,
        contractNumber: charge.contractNumber,
        bankDetails: settings.bankDetails,
      })
    );
  };

  const handleSaveSettings = async (next: typeof settings) => {
    await saveSettings(next);
    success(canUpdate ? 'Mensagem padrão salva para toda a equipe' : 'Mensagem padrão salva neste navegador');
    if (waTarget) {
      openWhatsApp(waTarget.client, waTarget.charge);
    }
  };

  const sendWhatsApp = async () => {
    if (!waTarget) return;
    const href = whatsAppHref(waTarget.phone, waMessage.trim());
    if (!href) {
      toastError('Cliente sem WhatsApp ou telefone cadastrado');
      return;
    }
    if (report?.historyAvailable) {
      try {
        await createChargeCollectionEvent(waTarget.charge.id, {
          note: waMessage.trim().slice(0, 500),
          outcome: 'sent',
          channel: 'whatsapp',
        });
        waTarget.charge.collectionCount += 1;
      } catch {
        /* não bloqueia envio */
      }
    }
    window.open(href, '_blank', 'noopener,noreferrer');
    success('WhatsApp aberto · contato registrado no histórico');
    setWaTarget(null);
  };

  const buyers = useMemo(
    () => clients.filter((c) => c.is_buyer).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clients]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          Relatório analítico de contas a receber · cobrança com WhatsApp e histórico por parcela
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/app/recebiveis" className="text-xs font-medium text-brand-brown hover:underline">
            ← Visão de recebíveis
          </Link>
          <ReceivablesWhatsappTemplateEditor
            settings={settings}
            onSave={handleSaveSettings}
            canSaveToServer={!!canUpdate}
            triggerClassName="inline-flex items-center gap-1 rounded-lg border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-off-white"
          />
        </div>
      </div>

      <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-brand-olive/70">
          Filtros do relatório
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <label className="block text-sm sm:col-span-2 lg:col-span-2 xl:col-span-2">
            <span className="mb-1 block text-brand-dark-brown">Palavra-chave</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void search()}
              placeholder="Animal, contrato, código..."
              className="w-full rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive"
            />
          </label>

          <label className="block text-sm lg:col-span-1 xl:col-span-1">
            <span className="mb-1 block text-brand-dark-brown">Cliente</span>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive"
            >
              <option value="">Todos</option>
              {buyers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm lg:col-span-1 xl:col-span-1">
            <span className="mb-1 block text-brand-dark-brown">Situação</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ReceivablesAnalyticalStatus)}
              className="w-full rounded-xl border border-brand-beige px-3 py-2 text-sm outline-none focus:border-brand-olive"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-brand-dark-brown">Data inicial</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-2 py-2 text-sm outline-none focus:border-brand-olive"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-brand-dark-brown">Data final</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-xl border border-brand-beige px-2 py-2 text-sm outline-none focus:border-brand-olive"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-beige/80 pt-3">
          <p className="text-[11px] text-brand-olive/75">
            Ajuste os filtros e clique em Pesquisar · Enter na palavra-chave também busca
          </p>
          <AppButton onClick={() => void search()} loading={loading} className="inline-flex shrink-0 items-center gap-2">
            <Search className="h-4 w-4" />
            Pesquisar
          </AppButton>
        </div>
      </section>

      <main className="min-w-0 space-y-4">
        {loading && <ListPageSkeleton variant="table" />}

        {!loading && !searched && (
          <div className="rounded-2xl border border-brand-beige bg-white px-6 py-16 text-center shadow-card">
            <p className="text-lg font-semibold text-brand-dark-brown">Pronto para gerar o relatório?</p>
            <p className="mt-2 text-sm text-brand-olive">
              Use os filtros acima e clique em <strong>Pesquisar</strong> para ver as cobranças por cliente.
            </p>
          </div>
        )}

        {!loading && searched && report && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Clientes" value={String(report.summary.clientCount)} />
              <SummaryCard label="Parcelas" value={String(report.summary.itemCount)} />
              <SummaryCard label="Valor original" value={money(report.summary.originalTotal)} />
              <SummaryCard
                label="Em aberto"
                value={money(report.summary.openTotal)}
                hint={`Pagas: ${money(report.summary.paidTotal)}`}
              />
            </div>

            {report.clients.length === 0 ? (
              <p className="rounded-2xl border border-brand-beige bg-white py-12 text-center text-sm text-brand-olive shadow-card">
                Nenhum lançamento encontrado com estes filtros.
              </p>
            ) : (
              report.clients.map((client, idx) => (
                <ClientReportBlock
                  key={client.clientId}
                  index={idx + 1}
                  client={client}
                  onWhatsApp={(charge) => openWhatsApp(client, charge)}
                  onHistory={(charge) =>
                    setHistoryCharge({ charge, clientName: client.clientName })
                  }
                />
              ))
            )}

            {report.clients.length > 0 && (
              <div className="rounded-2xl border border-brand-beige bg-brand-off-white/50 p-4 text-sm shadow-card">
                <p className="font-semibold text-brand-dark-brown">Valor total das cobranças</p>
                <div className="mt-2 flex flex-wrap gap-6 text-brand-brown">
                  <span>Original: {money(report.summary.originalTotal)}</span>
                  <span>Pago: {money(report.summary.paidTotal)}</span>
                  <span>Em aberto: {money(report.summary.openTotal)}</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Modal
        open={!!waTarget}
        onClose={() => setWaTarget(null)}
        title="Cobrar via WhatsApp"
        subtitle={waTarget?.client.clientName}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-olive">
            Edite a mensagem antes de enviar.{' '}
            <ReceivablesWhatsappTemplateEditor
              settings={settings}
              onSave={handleSaveSettings}
              canSaveToServer={!!canUpdate}
              triggerClassName="font-medium text-brand-brown hover:underline"
              triggerLabel="Personalizar mensagem"
            />
          </p>
          <textarea
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-olive"
          />
          <div className="flex justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setWaTarget(null)}>
              Cancelar
            </AppButton>
            <AppButton onClick={() => void sendWhatsApp()} disabled={!waMessage.trim()}>
              Abrir WhatsApp
            </AppButton>
          </div>
        </div>
      </Modal>

      <CollectionHistoryModal
        open={!!historyCharge}
        onClose={() => setHistoryCharge(null)}
        charge={historyCharge?.charge ?? null}
        clientName={historyCharge?.clientName}
        historyAvailable={report?.historyAvailable ?? false}
        onSaved={() => void search()}
      />
    </div>
  );
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <p className="mt-1 text-xl font-semibold text-brand-dark-brown">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-brand-olive">{hint}</p>}
    </div>
  );
}

function ClientReportBlock({
  index,
  client,
  onWhatsApp,
  onHistory,
}: {
  index: number;
  client: ReceivablesAnalyticalClient;
  onWhatsApp: (charge: ReceivablesAnalyticalItem) => void;
  onHistory: (charge: ReceivablesAnalyticalItem) => void;
}) {
  const doc =
    client.document && client.documentType
      ? `${client.documentType}: ${client.document}`
      : client.document || '—';
  const phone = [client.whatsapp, client.phone].filter(Boolean).join(' · ') || '—';

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
      <header className="border-b border-brand-beige bg-brand-off-white/60 px-4 py-3">
        <p className="font-semibold text-brand-dark-brown">
          {index} — {client.clientName}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-brand-olive">
          <span>Código: {client.clientId}</span>
          <span>{doc}</span>
          <span>Celular: {phone}</span>
          {client.email && <span>E-mail: {client.email}</span>}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-2 py-2 font-medium">#</th>
              <th className="px-2 py-2 font-medium">Código</th>
              <th className="px-2 py-2 font-medium">Descrição</th>
              <th className="px-2 py-2 font-medium">Valor</th>
              <th className="px-2 py-2 font-medium">Vencimento</th>
              <th className="px-2 py-2 font-medium">Dias</th>
              <th className="px-2 py-2 font-medium">Pago</th>
              <th className="px-2 py-2 font-medium">Situação</th>
              <th className="px-2 py-2 font-medium">Cobrador</th>
              <th className="px-2 py-2 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {client.items.map((item, i) => (
              <tr key={item.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/40">
                <td className="px-2 py-2 text-brand-olive">{i + 1}</td>
                <td className="px-2 py-2 font-mono text-xs text-brand-brown">{item.id}</td>
                <td className="max-w-xs px-2 py-2 text-brand-dark-brown">
                  <p className="line-clamp-2" title={item.description}>
                    {item.description}
                  </p>
                </td>
                <td className="whitespace-nowrap px-2 py-2">{money(item.amount)}</td>
                <td className="whitespace-nowrap px-2 py-2">{formatDateBR(item.dueDate)}</td>
                <td className={`px-2 py-2 ${item.daysOverdue > 0 ? 'font-medium text-red-700' : 'text-brand-olive'}`}>
                  {item.daysOverdue > 0 ? `${item.daysOverdue}d` : '—'}
                </td>
                <td className="whitespace-nowrap px-2 py-2">{money(item.paidAmount)}</td>
                <td className="px-2 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${statusTone[item.status] || statusTone.pendente}`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-2 py-2 text-xs">{CHARGE_COLLECTOR_SHORT[item.collector]}</td>
                <td className="whitespace-nowrap px-2 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    {(client.whatsapp || client.phone) && item.status !== 'pago' && item.status !== 'cancelado' && (
                      <button
                        type="button"
                        onClick={() => onWhatsApp(item)}
                        className={cobrarButtonClassName}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Cobrar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onHistory(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-beige px-2 py-1 text-xs text-brand-olive hover:bg-brand-off-white"
                    >
                      <History className="h-3.5 w-3.5" /> ({item.collectionCount})
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-brand-beige bg-brand-off-white/40 text-sm font-medium text-brand-dark-brown">
            <tr>
              <td colSpan={3} className="px-2 py-2">
                Total do cliente
              </td>
              <td className="px-2 py-2">{money(client.originalTotal)}</td>
              <td colSpan={2} />
              <td className="px-2 py-2">{money(client.paidTotal)}</td>
              <td colSpan={3} className="px-2 py-2 text-brand-olive">
                Em aberto: {money(client.openTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
