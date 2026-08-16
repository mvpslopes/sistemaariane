import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MessageCircle, FileDown, Settings2 } from 'lucide-react';
import { getReceivablesDashboard, type ReceivablesDashboard } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import DonutChart from '../../components/DonutChart';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import { CHARGE_COLLECTOR_SHORT } from '../../constants/chargeCollectors';
import { cobrarButtonClassName, cobrarIconButtonClassName } from '../../constants/collectionActions';
import { formatDateBR } from '../../utils/dateTime';
import {
  applyReceivablesWhatsappTemplate,
  DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE,
  loadReceivablesWhatsappTemplate,
  RECEIVABLES_WHATSAPP_PLACEHOLDERS,
  saveReceivablesWhatsappTemplate,
  whatsAppHref,
  type ReceivablesWhatsAppContext,
} from '../../utils/receivablesWhatsapp';
import { downloadReceivablesPdf } from './printReceivablesPdf';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

type WhatsAppTarget = {
  phone: string | null | undefined;
  context: ReceivablesWhatsAppContext;
};

export default function ReceivablesPage() {
  const { error: toastError, success } = useToast();
  const [data, setData] = useState<ReceivablesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [waTarget, setWaTarget] = useState<WhatsAppTarget | null>(null);
  const [waMessage, setWaMessage] = useState('');
  const [templateDraft, setTemplateDraft] = useState(DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const openWhatsApp = (target: WhatsAppTarget) => {
    const template = loadReceivablesWhatsappTemplate();
    setWaTarget(target);
    setWaMessage(applyReceivablesWhatsappTemplate(template, target.context));
  };

  const openTemplateEditor = () => {
    setTemplateDraft(loadReceivablesWhatsappTemplate());
    setTemplateModalOpen(true);
  };

  const saveTemplate = () => {
    const template = templateDraft.trim() || DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE;
    saveReceivablesWhatsappTemplate(template);
    if (waTarget) {
      setWaMessage(applyReceivablesWhatsappTemplate(template, waTarget.context));
    }
    success('Mensagem padrão salva neste navegador');
    setTemplateModalOpen(false);
  };

  const sendWhatsApp = () => {
    if (!waTarget) return;
    const href = whatsAppHref(waTarget.phone, waMessage.trim());
    if (!href) {
      toastError('Cliente sem WhatsApp ou telefone cadastrado');
      return;
    }
    window.open(href, '_blank', 'noopener,noreferrer');
    setWaTarget(null);
  };
  useEffect(() => {
    getReceivablesDashboard()
      .then(setData)
      .catch((e: unknown) => toastError(e instanceof Error ? e.message : 'Erro ao carregar recebíveis'))
      .finally(() => setLoading(false));
  }, [toastError]);

  const agingSlices = useMemo(() => {
    if (!data) return [];
    const a = data.aging;
    return [
      { label: 'A vencer', value: a.current, color: '#4A6650' },
      { label: '1–30 dias', value: a.d1_30, color: '#C08A3E' },
      { label: '31–60 dias', value: a.d31_60, color: '#A0896A' },
      { label: '61–90 dias', value: a.d61_90, color: '#81705F' },
      { label: '90+ dias', value: a.d90_plus, color: '#8B1E1E' },
    ];
  }, [data]);

  if (loading) return <ListPageSkeleton variant="cards" />;
  if (!data) {
    return (
      <p className="py-10 text-center text-sm text-brand-olive">Não foi possível carregar os recebíveis.</p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          Visão de inadimplência e parcelas em aberto · integração bancária prevista para fase futura.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/app/relatorio-cobranca"
            className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-3 py-2 text-xs font-medium text-brand-brown shadow-card hover:bg-brand-off-white"
          >
            <MessageCircle className="h-4 w-4" /> Relatório de cobrança
          </Link>
          <AppButton
          variant="secondary"
          loading={exporting}
          onClick={async () => {
            if (!data) return;
            setExporting(true);
            try {
              await downloadReceivablesPdf(data);
            } catch (e: unknown) {
              toastError(e instanceof Error ? e.message : 'Erro ao exportar PDF');
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" /> Exportar PDF
        </AppButton>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Em aberto" value={money(data.openTotal)} hint={`${data.openCount} parcela(s)`} />
        <Kpi
          label="Inadimplente"
          value={money(data.overdueTotal)}
          hint={`${data.overdueCount} parcela(s)`}
          tone="warn"
        />
        <Kpi
          label="Assessoria atrasada"
          value={money(data.byCollector.assessoria.overdue)}
          hint={`${data.byCollector.assessoria.overdueCount} parcela(s)`}
        />
        <Kpi
          label="Vendedor atrasada"
          value={money(data.byCollector.seller.overdue)}
          hint={`${data.byCollector.seller.overdueCount} parcela(s)`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChart title="Envelhecimento (R$)" slices={agingSlices} valueType="currency" />
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-brand-dark-brown">Maiores devedores</h3>
            <button
              type="button"
              onClick={openTemplateEditor}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-brown hover:underline"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Personalizar mensagem
            </button>
          </div>
          {data.topDebtors.length === 0 ? (
            <p className="text-sm text-brand-olive">Nenhuma inadimplência no momento.</p>
          ) : (
            <ul className="space-y-2">
              {data.topDebtors.map((d) => {
                const hasPhone = Boolean(String(d.whatsapp || d.phone || '').replace(/\D/g, ''));
                return (
                  <li
                    key={d.clientId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-brand-beige/80 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-brand-dark-brown">{d.clientName}</p>
                      <p className="text-xs text-brand-olive">
                        {money(d.overdueAmount)} · {d.chargesCount} parcela(s)
                        {d.oldestDue ? ` · mais antiga ${formatDateBR(d.oldestDue)}` : ''}
                      </p>
                    </div>
                    {hasPhone ? (
                      <button
                        type="button"
                        onClick={() =>
                          openWhatsApp({
                            phone: d.whatsapp || d.phone,
                            context: {
                              clientName: d.clientName,
                              overdueAmount: d.overdueAmount,
                              chargesCount: d.chargesCount,
                              oldestDue: d.oldestDue,
                            },
                          })
                        }
                        className={`shrink-0 ${cobrarButtonClassName}`}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Cobrar
                      </button>
                    ) : (
                      <span className="shrink-0 text-[11px] text-brand-olive">Sem WhatsApp</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <div className="flex items-center justify-between gap-2 border-b border-brand-beige px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark-brown">
            <AlertTriangle className="h-4 w-4 text-red-600" /> Parcelas atrasadas
          </h3>
          <Link to="/app/cobrancas" className="text-xs font-medium text-brand-brown hover:underline">
            Ver todas as cobranças
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Animal</th>
                <th className="px-3 py-2 font-medium">Vencimento</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Cobrador</th>
                <th className="px-3 py-2 font-medium">Dias</th>
              </tr>
            </thead>
            <tbody>
              {data.overdueItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-brand-olive">
                    Nenhuma parcela atrasada
                  </td>
                </tr>
              )}
              {data.overdueItems.map((item) => {
                const hasPhone = Boolean(String(item.whatsapp || '').replace(/\D/g, ''));
                return (
                  <tr key={item.id} className="border-t border-brand-beige/70">
                    <td className="px-3 py-2 font-medium">{item.clientName}</td>
                    <td className="hidden px-3 py-2 md:table-cell">{item.animalName || '—'}</td>
                    <td className="px-3 py-2">{formatDateBR(item.dueDate)}</td>
                    <td className="px-3 py-2">{money(item.amount)}</td>
                    <td className="hidden px-3 py-2 sm:table-cell">
                      {CHARGE_COLLECTOR_SHORT[item.collector as keyof typeof CHARGE_COLLECTOR_SHORT] ||
                        item.collector}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-red-700">{item.daysOverdue}d</span>
                        {hasPhone && (
                          <button
                            type="button"
                            onClick={() =>
                              openWhatsApp({
                                phone: item.whatsapp,
                                context: {
                                  clientName: item.clientName,
                                  overdueAmount: item.amount,
                                  chargesCount: 1,
                                  oldestDue: item.dueDate,
                                  animalName: item.animalName,
                                },
                              })
                            }
                            className={cobrarIconButtonClassName}
                            title="Cobrar"
                            aria-label="Cobrar"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={!!waTarget}
        onClose={() => setWaTarget(null)}
        title="Mensagem para WhatsApp"
        subtitle={waTarget?.context.clientName}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-brand-olive">
            Edite a mensagem abaixo antes de enviar. Use{' '}
            <button
              type="button"
              onClick={openTemplateEditor}
              className="font-medium text-brand-brown hover:underline"
            >
              Personalizar mensagem
            </button>{' '}
            para alterar o modelo padrão.
          </p>
          <textarea
            value={waMessage}
            onChange={(e) => setWaMessage(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-brand-beige px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <AppButton variant="secondary" onClick={() => setWaTarget(null)}>
              Cancelar
            </AppButton>
            <AppButton onClick={sendWhatsApp} disabled={!waMessage.trim()}>
              Abrir WhatsApp
            </AppButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Mensagem padrão de cobrança"
        subtitle="Salva neste navegador · use variáveis que são preenchidas automaticamente"
        size="lg"
      >
        <div className="space-y-4">
          <textarea
            value={templateDraft}
            onChange={(e) => setTemplateDraft(e.target.value)}
            rows={10}
            className="w-full rounded-xl border border-brand-beige px-3 py-2.5 font-mono text-sm leading-relaxed outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
          />
          <div className="rounded-xl border border-brand-beige bg-brand-off-white/50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-olive">
              Variáveis disponíveis
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {RECEIVABLES_WHATSAPP_PLACEHOLDERS.map((p) => (
                <li key={p.key} className="text-xs text-brand-brown">
                  <code className="rounded bg-white px-1 py-0.5 text-[11px]">{p.key}</code>{' '}
                  <span className="text-brand-olive">— {p.hint}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap justify-between gap-2">
            <AppButton
              variant="secondary"
              onClick={() => setTemplateDraft(DEFAULT_RECEIVABLES_WHATSAPP_TEMPLATE)}
            >
              Restaurar padrão
            </AppButton>
            <div className="flex gap-2">
              <AppButton variant="secondary" onClick={() => setTemplateModalOpen(false)}>
                Cancelar
              </AppButton>
              <AppButton onClick={saveTemplate}>Salvar modelo</AppButton>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-card ${
        tone === 'warn' ? 'border-red-200' : 'border-brand-beige'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === 'warn' ? 'text-red-800' : 'text-brand-dark-brown'}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-brand-olive">{hint}</p>}
    </div>
  );
}
