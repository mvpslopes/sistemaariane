import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet, FileDown } from 'lucide-react';
import {
  createAuctionExpense,
  deleteAuctionExpense,
  getAuctionFinance,
  type AuctionExpense,
  type AuctionExpenseCategory,
  type AuctionFinance,
} from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import AppButton from '../../components/AppButton';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import {
  AUCTION_EXPENSE_CATEGORIES,
  auctionExpenseCategoryLabel,
} from '../../constants/auctionFinance';
import { formatDateBR, todayDateISO } from '../../utils/dateTime';
import { downloadAuctionReportPdf, type AuctionReportMeta } from './printAuctionReportPdf';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const contractStatusLabel: Record<string, string> = {
  rascunho: 'Rascunho',
  pendente_envio: 'Pendente envio',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
};

interface AuctionFinancePanelProps {
  auctionId: string;
  auctionMeta: AuctionReportMeta;
  canCreate: boolean;
  canUpdate: boolean;
}

const emptyExpenseForm = {
  category: 'outros' as AuctionExpenseCategory,
  description: '',
  amount: '',
  expenseDate: todayDateISO(),
};

export default function AuctionFinancePanel({
  auctionId,
  auctionMeta,
  canCreate,
  canUpdate,
}: AuctionFinancePanelProps) {
  const { success, error: toastError } = useToast();
  const [finance, setFinance] = useState<AuctionFinance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyExpenseForm);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFinance(await getAuctionFinance(auctionId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar financeiro';
      toastError(msg);
    } finally {
      setLoading(false);
    }
  }, [auctionId, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const onAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(String(form.amount).replace(',', '.'));
    if (!amount || amount <= 0) {
      toastError('Informe um valor válido');
      return;
    }
    setSaving(true);
    try {
      await createAuctionExpense(auctionId, {
        category: form.category,
        description: form.description.trim() || undefined,
        amount,
        expenseDate: form.expenseDate || undefined,
      });
      success('Despesa registrada');
      setForm(emptyExpenseForm);
      setFormOpen(false);
      await load();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Erro ao salvar despesa');
    } finally {
      setSaving(false);
    }
  };

  const onDeleteExpense = async (exp: AuctionExpense) => {
    if (!confirm(`Excluir despesa de ${money(exp.amount)}?`)) return;
    setDeletingId(exp.id);
    try {
      await deleteAuctionExpense(auctionId, exp.id);
      success('Despesa excluída');
      await load();
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeletingId(null);
    }
  };

  const onExportPdf = async () => {
    if (!finance) return;
    setExportingPdf(true);
    try {
      await downloadAuctionReportPdf(auctionMeta, finance);
      success('PDF gerado');
    } catch (err: unknown) {
      toastError(err instanceof Error ? err.message : 'Erro ao gerar PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return <ListPageSkeleton variant="table" rows={4} columns={3} />;
  }

  if (!finance) {
    return (
      <p className="py-8 text-center text-sm text-brand-olive">
        Não foi possível carregar o financeiro deste leilão.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AppButton
          type="button"
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          loading={exportingPdf}
          onClick={onExportPdf}
        >
          <FileDown className="h-3.5 w-3.5" /> Relatório PDF
        </AppButton>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceCard
          icon={TrendingUp}
          label="Arrematações"
          value={money(finance.revenue_total)}
          hint={`${finance.lots_sold}/${finance.lots_total} lotes vendidos`}
          tone="neutral"
        />
        <FinanceCard
          icon={Wallet}
          label="Comissão assessoria (estim.)"
          value={money(finance.assessoria_estimated)}
          hint="Com base nas regras de repasse dos contratos"
          tone="positive"
        />
        <FinanceCard
          icon={TrendingDown}
          label="Despesas"
          value={money(finance.expenses_total)}
          hint={`${finance.expenses.length} lançamento(s)`}
          tone="negative"
        />
        <FinanceCard
          icon={Wallet}
          label="Resultado líquido (estim.)"
          value={money(finance.result_net)}
          hint="Comissão assessoria − despesas"
          tone={finance.result_net >= 0 ? 'positive' : 'negative'}
        />
      </div>

      {finance.contracts.length > 0 && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold text-brand-dark-brown">Receitas — contratos do evento</h4>
          <div className="overflow-hidden rounded-xl border border-brand-beige">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-off-white text-brand-olive">
                <tr>
                  <th className="px-3 py-2 font-medium">Lote / Animal</th>
                  <th className="hidden px-3 py-2 font-medium sm:table-cell">Comprador</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="hidden px-3 py-2 font-medium md:table-cell">Assessoria</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {finance.contracts.map((c) => (
                  <tr key={c.id} className="border-t border-brand-beige/70">
                    <td className="px-3 py-2">
                      <span className="font-medium text-brand-dark-brown">{c.animal_name || '—'}</span>
                      {c.lot_number && (
                        <span className="ml-1 text-xs text-brand-olive">· Lote {c.lot_number}</span>
                      )}
                    </td>
                    <td className="hidden px-3 py-2 sm:table-cell">{c.buyer_name || '—'}</td>
                    <td className="px-3 py-2 font-medium">{money(c.total_amount)}</td>
                    <td className="hidden px-3 py-2 md:table-cell text-brand-olive">
                      {c.assessoria_pct > 0
                        ? `${money(c.assessoria_amount)} (${c.assessoria_pct}%)`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {contractStatusLabel[c.status] || c.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-brand-olive/80">
            Inclui contratos não cancelados (rascunho, pendente envio, aguardando assinatura, ativos e concluídos).
          </p>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-brand-dark-brown">Despesas do evento</h4>
          {canCreate && !formOpen && (
            <AppButton type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Nova despesa
            </AppButton>
          )}
        </div>

        {formOpen && canCreate && (
          <form
            onSubmit={onAddExpense}
            className="space-y-3 rounded-xl border border-brand-beige bg-brand-off-white/50 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase text-brand-olive">Categoria</span>
                <select
                  className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value as AuctionExpenseCategory }))
                  }
                >
                  {AUCTION_EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase text-brand-olive">Valor (R$) *</span>
                <input
                  required
                  type="number"
                  min={0.01}
                  step={0.01}
                  className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium uppercase text-brand-olive">Data</span>
                <input
                  type="date"
                  className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm"
                  value={form.expenseDate}
                  onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs font-medium uppercase text-brand-olive">Descrição</span>
                <input
                  className="w-full rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm"
                  placeholder="Ex.: equipe de apoio, coffee break..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <AppButton type="submit" loading={saving} className="text-xs">
                Salvar despesa
              </AppButton>
              <AppButton
                type="button"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  setFormOpen(false);
                  setForm(emptyExpenseForm);
                }}
              >
                Cancelar
              </AppButton>
            </div>
          </form>
        )}

        {finance.expenses.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-beige py-8 text-center text-sm text-brand-olive">
            Nenhuma despesa lançada neste leilão.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-brand-beige">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-brand-off-white text-brand-olive">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 font-medium">Descrição</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  {canUpdate && <th className="px-3 py-2 w-10" />}
                </tr>
              </thead>
              <tbody>
                {finance.expenses.map((exp) => (
                  <tr key={exp.id} className="border-t border-brand-beige/70">
                    <td className="px-3 py-2 text-brand-olive">
                      {exp.expense_date ? formatDateBR(exp.expense_date) : '—'}
                    </td>
                    <td className="px-3 py-2">{auctionExpenseCategoryLabel(exp.category)}</td>
                    <td className="px-3 py-2 text-brand-olive">{exp.description || '—'}</td>
                    <td className="px-3 py-2 font-medium text-red-700">{money(exp.amount)}</td>
                    {canUpdate && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          disabled={deletingId === exp.id}
                          onClick={() => onDeleteExpense(exp)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          aria-label="Excluir despesa"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function FinanceCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  hint: string;
  tone: 'neutral' | 'positive' | 'negative';
}) {
  const toneClass =
    tone === 'positive'
      ? 'border-brand-forest/25 bg-brand-forest/5'
      : tone === 'negative'
        ? 'border-red-200/80 bg-red-50/50'
        : 'border-brand-beige bg-white';

  return (
    <div className={`rounded-2xl border p-4 shadow-card ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-brand-olive">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-semibold text-brand-dark-brown">{value}</p>
      <p className="mt-1 text-[11px] text-brand-olive/80">{hint}</p>
    </div>
  );
}
