import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MessageCircle, FileDown } from 'lucide-react';
import { getReceivablesDashboard, type ReceivablesDashboard } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import DonutChart from '../../components/DonutChart';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import ReceivablesWhatsappTemplateEditor from '../../components/ReceivablesWhatsappTemplateEditor';
import { useReceivablesWhatsappTemplate } from '../../hooks/useReceivablesWhatsappTemplate';
import { CHARGE_COLLECTOR_SHORT } from '../../constants/chargeCollectors';
import { cobrarButtonClassName, cobrarIconButtonClassName } from '../../constants/collectionActions';
import { formatDateBR } from '../../utils/dateTime';
import {
  applyReceivablesWhatsappTemplate,
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
  const { canUpdate } = useAuth();
  const { settings, resolveTemplate, saveSettings } = useReceivablesWhatsappTemplate(!!canUpdate);
  const [data, setData] = useState<ReceivablesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [waTarget, setWaTarget] = useState<WhatsAppTarget | null>(null);
  const [waMessage, setWaMessage] = useState('');

  const buildMessage = (context: ReceivablesWhatsAppContext) =>
    applyReceivablesWhatsappTemplate(resolveTemplate(), {
      ...context,
      bankDetails: settings.bankDetails,
    });

  const openWhatsApp = (target: WhatsAppTarget) => {
    setWaTarget(target);
    setWaMessage(buildMessage(target.context));
  };

  const handleSaveSettings = async (next: typeof settings) => {
    await saveSettings(next);
    success(canUpdate ? 'Mensagem padrão salva para toda a equipe' : 'Mensagem padrão salva neste navegador');
    if (waTarget) {
      setWaMessage(buildMessage(waTarget.context));
    }
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
            <ReceivablesWhatsappTemplateEditor
              settings={settings}
              onSave={handleSaveSettings}
              canSaveToServer={!!canUpdate}
            />
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
                                  contractNumber: item.contractNumber,
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
            Edite a mensagem abaixo antes de enviar.{' '}
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
