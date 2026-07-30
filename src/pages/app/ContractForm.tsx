import { useEffect, useMemo, useState } from 'react';
import {
  createContract,
  getAnimals,
  getClients,
  getContractTemplates,
  type Animal,
  type Client,
  type ContractTemplate,
  type PaymentMethod,
  type PayoutRole,
  type SaleType,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';

interface PayoutRuleInput {
  key: string;
  beneficiaryRole: PayoutRole;
  beneficiaryClientId: string;
  label: string;
  pct: string;
}

interface ContractFormProps {
  animalId?: string | null;
  sellerId?: string | null;
  auctionId?: string | null;
  lotId?: string | null;
  lotLabel?: string | null;
  suggestedAmount?: number | null;
  onClose: () => void;
  onSaved: (contractId: string) => void;
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige disabled:bg-brand-off-white';

const roleLabel: Record<PayoutRole, string> = {
  assessoria: 'Assessoria',
  seller: 'Vendedor / dono',
  assessor: 'Assessor',
  outro: 'Outro',
};

let ruleKey = 0;
const newRule = (partial?: Partial<PayoutRuleInput>): PayoutRuleInput => ({
  key: `r${++ruleKey}`,
  beneficiaryRole: 'seller',
  beneficiaryClientId: '',
  label: '',
  pct: '',
  ...partial,
});

export default function ContractForm({
  animalId,
  sellerId,
  auctionId,
  lotId,
  lotLabel,
  suggestedAmount,
  onClose,
  onSaved,
}: ContractFormProps) {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [sellers, setSellers] = useState<Client[]>([]);
  const [buyers, setBuyers] = useState<Client[]>([]);
  const [assessors, setAssessors] = useState<Client[]>([]);
  const [witnesses, setWitnesses] = useState<Client[]>([]);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [form, setForm] = useState({
    animalId: animalId || '',
    saleType: 'inteiro' as SaleType,
    sharePct: 100,
    sellerId: sellerId || '',
    buyerId: '',
    assessorId: '',
    templateId: '',
    lotLabel: lotLabel || '',
    animalCategory: '',
    quantity: '1',
    commissionTotalPct: '17',
    commissionBuyerPct: '8.5',
    commissionSellerPct: '8.5',
    witness1Id: '',
    witness2Id: '',
    totalAmount: suggestedAmount != null ? String(suggestedAmount) : '',
    paymentMethod: 'boleto' as PaymentMethod,
    installments: 1,
    firstDueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [rules, setRules] = useState<PayoutRuleInput[]>([
    newRule({ beneficiaryRole: 'assessoria', pct: '10', label: 'Assessoria' }),
    newRule({ beneficiaryRole: 'seller', pct: '90', label: 'Vendedor' }),
  ]);

  useEffect(() => {
    Promise.all([
      getAnimals(),
      getClients(undefined, 'seller'),
      getClients(undefined, 'buyer'),
      getClients(undefined, 'assessor'),
      getClients(undefined, 'witness'),
      getClients(),
      getContractTemplates({ active: true }),
    ])
      .then(([a, s, b, ass, wit, all, tpls]) => {
        setAnimals(a.filter((x) => x.status === 'ativo'));
        setSellers(s.filter((c) => c.active));
        setBuyers(b.filter((c) => c.active));
        setAssessors(ass.filter((c) => c.active));
        setWitnesses(wit.filter((c) => c.active));
        setAllClients(all.filter((c) => c.active));
        setTemplates(tpls);
        const def = tpls.find((t) => t.is_default) || tpls[0];
        if (def) setForm((f) => ({ ...f, templateId: def.id }));
        if (s.filter((c) => c.active).length === 0) {
          getClients().then((list) => setSellers(list.filter((c) => c.active)));
        }
        if (b.filter((c) => c.active).length === 0) {
          getClients().then((list) => setBuyers(list.filter((c) => c.active)));
        }
      })
      .catch((e) => toastError(e.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, [toastError]);

  useEffect(() => {
    if (!form.sellerId) return;
    setRules((prev) =>
      prev.map((r) =>
        r.beneficiaryRole === 'seller' && !r.beneficiaryClientId
          ? { ...r, beneficiaryClientId: form.sellerId }
          : r
      )
    );
  }, [form.sellerId]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const pctSum = useMemo(
    () => rules.reduce((s, r) => s + (Number(r.pct) || 0), 0),
    [rules]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    if (rules.length > 0 && pctSum > 100.01) {
      toastError('A soma dos % de repasse não pode passar de 100%');
      return;
    }
    setSaving(true);
    try {
      const payoutRules = rules
        .filter((r) => Number(r.pct) > 0)
        .map((r) => ({
          beneficiaryRole: r.beneficiaryRole,
          beneficiaryClientId:
            r.beneficiaryRole === 'assessoria'
              ? r.beneficiaryClientId || null
              : r.beneficiaryClientId || null,
          label: r.label || roleLabel[r.beneficiaryRole],
          pct: Number(r.pct),
        }));

      const res = await createContract({
        animalId: form.animalId,
        saleType: form.saleType,
        sharePct: form.saleType === 'inteiro' ? 100 : Number(form.sharePct),
        sellerId: form.sellerId,
        buyerId: form.buyerId,
        assessorId: form.assessorId || null,
        auctionId: auctionId || null,
        lotId: lotId || null,
        templateId: form.templateId || null,
        lotLabel: form.lotLabel || null,
        animalCategory: form.animalCategory || null,
        quantity: Number(form.quantity) || 1,
        commissionTotalPct: form.commissionTotalPct !== '' ? Number(form.commissionTotalPct) : null,
        commissionBuyerPct: form.commissionBuyerPct !== '' ? Number(form.commissionBuyerPct) : null,
        commissionSellerPct: form.commissionSellerPct !== '' ? Number(form.commissionSellerPct) : null,
        witness1Id: form.witness1Id || null,
        witness2Id: form.witness2Id || null,
        totalAmount: Number(form.totalAmount),
        paymentMethod: form.paymentMethod,
        installments: Number(form.installments),
        firstDueDate: form.firstDueDate,
        notes: form.notes || null,
        payoutRules,
      });
      success(
        lotId
          ? 'Arremate registrado: contrato, cobranças e repasses gerados'
          : 'Contrato, cobranças e repasses gerados'
      );
      onSaved(res.id);
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao criar contrato');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando formulário..." />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {lotId && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Registrando arremate do lote — gera contrato, cobranças e repasses parcelados.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Modelo do verso *</span>
          <select
            required
            disabled={!canWrite}
            value={form.templateId}
            onChange={(e) => set('templateId', e.target.value)}
            className={inputClass}
          >
            <option value="">— Selecionar modelo —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <span className="text-xs text-brand-olive">A frente é preenchida automaticamente; o verso usa este texto.</span>
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Animal *</span>
          <select
            required
            disabled={!!animalId || !canWrite}
            value={form.animalId}
            onChange={(e) => set('animalId', e.target.value)}
            className={inputClass}
          >
            <option value="">— Selecionar —</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Tipo de venda *</span>
          <select
            disabled={!canWrite}
            value={form.saleType}
            onChange={(e) => set('saleType', e.target.value as SaleType)}
            className={inputClass}
          >
            <option value="inteiro">Animal inteiro</option>
            <option value="fracao">Fração</option>
            <option value="condominio">Condomínio</option>
          </select>
        </label>

        {form.saleType !== 'inteiro' && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Percentual (%) *</span>
            <input
              type="number"
              min={1}
              max={100}
              step={0.01}
              required
              disabled={!canWrite}
              value={form.sharePct}
              onChange={(e) => set('sharePct', Number(e.target.value))}
              className={inputClass}
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Vendedor *</span>
          <select
            required
            disabled={!!sellerId || !canWrite}
            value={form.sellerId}
            onChange={(e) => set('sellerId', e.target.value)}
            className={inputClass}
          >
            <option value="">— Selecionar —</option>
            {sellers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comprador *</span>
          <select required disabled={!canWrite} value={form.buyerId} onChange={(e) => set('buyerId', e.target.value)} className={inputClass}>
            <option value="">— Selecionar —</option>
            {buyers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Assessor (opcional)</span>
          <select disabled={!canWrite} value={form.assessorId} onChange={(e) => set('assessorId', e.target.value)} className={inputClass}>
            <option value="">— Nenhum —</option>
            {assessors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Nº do lote</span>
          <input disabled={!canWrite} value={form.lotLabel} onChange={(e) => set('lotLabel', e.target.value)} className={inputClass} placeholder="06" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Categoria</span>
          <input disabled={!canWrite} value={form.animalCategory} onChange={(e) => set('animalCategory', e.target.value)} className={inputClass} placeholder="POTRA, POTRO..." />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Quantidade</span>
          <input type="number" min={0.01} step={0.01} disabled={!canWrite} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão total %</span>
          <input type="number" min={0} step={0.01} disabled={!canWrite} value={form.commissionTotalPct} onChange={(e) => set('commissionTotalPct', e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão comprador %</span>
          <input type="number" min={0} step={0.01} disabled={!canWrite} value={form.commissionBuyerPct} onChange={(e) => set('commissionBuyerPct', e.target.value)} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão vendedor %</span>
          <input type="number" min={0} step={0.01} disabled={!canWrite} value={form.commissionSellerPct} onChange={(e) => set('commissionSellerPct', e.target.value)} className={inputClass} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Testemunha 1</span>
          <select disabled={!canWrite} value={form.witness1Id} onChange={(e) => set('witness1Id', e.target.value)} className={inputClass}>
            <option value="">— Nenhuma —</option>
            {(witnesses.length ? witnesses : allClients).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Testemunha 2</span>
          <select disabled={!canWrite} value={form.witness2Id} onChange={(e) => set('witness2Id', e.target.value)} className={inputClass}>
            <option value="">— Nenhuma —</option>
            {(witnesses.length ? witnesses : allClients).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Valor total (R$) *</span>
          <input
            type="number"
            min={0.01}
            step={0.01}
            required
            disabled={!canWrite}
            value={form.totalAmount}
            onChange={(e) => set('totalAmount', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Forma de pagamento *</span>
          <select
            disabled={!canWrite}
            value={form.paymentMethod}
            onChange={(e) => set('paymentMethod', e.target.value as PaymentMethod)}
            className={inputClass}
          >
            <option value="pix">PIX</option>
            <option value="boleto">Boleto</option>
            <option value="transferencia">Transferência</option>
            <option value="outro">Outro</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Parcelas (1–40) *</span>
          <input
            type="number"
            min={1}
            max={40}
            required
            disabled={!canWrite}
            value={form.installments}
            onChange={(e) => set('installments', Number(e.target.value))}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">1º vencimento *</span>
          <input
            type="date"
            required
            disabled={!canWrite}
            value={form.firstDueDate}
            onChange={(e) => set('firstDueDate', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Observações</span>
          <textarea disabled={!canWrite} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="rounded-2xl border border-brand-beige bg-brand-off-white/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-brand-dark-brown">Repasses (antes da venda)</h3>
            <p className="text-xs text-brand-olive">
              % retida em cada parcela. Soma atual:{' '}
              <span className={pctSum > 100 ? 'font-semibold text-red-700' : 'font-semibold'}>
                {pctSum.toFixed(2)}%
              </span>
            </p>
          </div>
          {canWrite && (
            <button
              type="button"
              onClick={() => setRules((r) => [...r, newRule({ beneficiaryRole: 'assessor', pct: '5' })])}
              className="rounded-lg border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium hover:bg-brand-beige/30"
            >
              + Beneficiário
            </button>
          )}
        </div>

        <div className="space-y-2">
          {rules.map((r, idx) => (
            <div key={r.key} className="grid gap-2 rounded-xl border border-brand-beige bg-white p-3 sm:grid-cols-12">
              <label className="sm:col-span-3">
                <span className="mb-1 block text-[10px] uppercase text-brand-olive">Papel</span>
                <select
                  disabled={!canWrite}
                  value={r.beneficiaryRole}
                  onChange={(e) => {
                    const role = e.target.value as PayoutRole;
                    setRules((list) =>
                      list.map((x, i) =>
                        i === idx
                          ? {
                              ...x,
                              beneficiaryRole: role,
                              beneficiaryClientId:
                                role === 'seller' ? form.sellerId || x.beneficiaryClientId : x.beneficiaryClientId,
                              label: x.label || roleLabel[role],
                            }
                          : x
                      )
                    );
                  }}
                  className={inputClass}
                >
                  <option value="assessoria">Assessoria</option>
                  <option value="seller">Vendedor</option>
                  <option value="assessor">Assessor</option>
                  <option value="outro">Outro</option>
                </select>
              </label>
              <label className="sm:col-span-4">
                <span className="mb-1 block text-[10px] uppercase text-brand-olive">Pessoa</span>
                <select
                  disabled={!canWrite}
                  value={r.beneficiaryClientId}
                  onChange={(e) =>
                    setRules((list) =>
                      list.map((x, i) => (i === idx ? { ...x, beneficiaryClientId: e.target.value } : x))
                    )
                  }
                  className={inputClass}
                >
                  <option value="">— {r.beneficiaryRole === 'assessoria' ? 'Assessoria (sem pessoa)' : 'Selecionar'} —</option>
                  {(r.beneficiaryRole === 'assessor' ? assessors : allClients).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[10px] uppercase text-brand-olive">%</span>
                <input
                  type="number"
                  min={0.01}
                  max={100}
                  step={0.01}
                  required
                  disabled={!canWrite}
                  value={r.pct}
                  onChange={(e) =>
                    setRules((list) => list.map((x, i) => (i === idx ? { ...x, pct: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-1 block text-[10px] uppercase text-brand-olive">Rótulo</span>
                <input
                  disabled={!canWrite}
                  value={r.label}
                  onChange={(e) =>
                    setRules((list) => list.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </label>
              <div className="flex items-end sm:col-span-1">
                {canWrite && rules.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRules((list) => list.filter((_, i) => i !== idx))}
                    className="rounded-lg px-2 py-2 text-xs text-red-700 hover:bg-red-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
        {canWrite && (
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
            {saving ? 'Gerando...' : lotId ? 'Confirmar arremate' : 'Gerar contrato, cobranças e repasses'}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
