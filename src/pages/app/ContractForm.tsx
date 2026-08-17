import { useEffect, useMemo, useState } from 'react';
import {
  createCatalogItem,
  createContract,
  getAnimals,
  getCatalogs,
  getClients,
  getContract,
  getContractTemplates,
  updateContract,
  type Animal,
  type CatalogItem,
  type ChargeCollector,
  type Client,
  type ContractTemplate,
  type PaymentMethod,
  type PayoutRole,
  type SaleType,
} from '../../services/apiService';
import { CHARGE_COLLECTOR_LABELS } from '../../constants/chargeCollectors';
import { DEFAULT_CONTRACT_DOCUMENT_TITLE } from '../../constants/contractDocument';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import { todayDateISO } from '../../utils/dateTime';
import { Plus } from 'lucide-react';

interface PayoutRuleInput {
  key: string;
  beneficiaryRole: PayoutRole;
  beneficiaryClientId: string;
  label: string;
  pct: string;
}

interface ContractFormProps {
  contractId?: string | null;
  animalId?: string | null;
  sellerId?: string | null;
  /** Quando o lote tem vários vendedores, restringe e permite escolher entre eles. */
  sellerIds?: string[] | null;
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

interface ScheduleRow {
  amount: string;
  dueDate: string;
  collector: ChargeCollector;
}

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Parcelas iguais, mensais, com a diferença de centavos na última. */
function buildEqualSchedule(total: number, n: number, firstDue: string): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  if (!(n > 0) || !firstDue) return rows;
  const base = Math.floor((total / n) * 100) / 100;
  const due = new Date(`${firstDue.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(due.getTime())) return rows;
  let sum = 0;
  for (let i = 1; i <= n; i++) {
    const amount = i === n ? Math.round((total - sum) * 100) / 100 : base;
    sum += amount;
    const y = due.getFullYear();
    const m = String(due.getMonth() + 1).padStart(2, '0');
    const d = String(due.getDate()).padStart(2, '0');
    rows.push({ amount: amount.toFixed(2), dueDate: `${y}-${m}-${d}`, collector: 'assessoria' });
    due.setMonth(due.getMonth() + 1);
  }
  return rows;
}

export default function ContractForm({
  contractId = null,
  animalId,
  sellerId,
  sellerIds,
  auctionId,
  lotId,
  lotLabel,
  suggestedAmount,
  onClose,
  onSaved,
}: ContractFormProps) {
  const isEdit = !!contractId;
  const { canCreate, canUpdate } = useAuth();
  const canSave = isEdit ? canUpdate : canCreate;
  const canEditFields = canSave;
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
  const [saleTypes, setSaleTypes] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [quotas, setQuotas] = useState<CatalogItem[]>([]);
  const [addingSaleType, setAddingSaleType] = useState(false);
  const [newSaleTypeName, setNewSaleTypeName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [addingQuota, setAddingQuota] = useState(false);
  const [newQuota, setNewQuota] = useState('');
  const [hasCommission, setHasCommission] = useState(!contractId);
  const [form, setForm] = useState({
    animalId: animalId || '',
    saleType: 'inteiro' as SaleType,
    sharePct: 100,
    sellerId: sellerId || '',
    buyerId: '',
    assessorId: '',
    templateId: '',
    versoTitle: '',
    versoBody: '',
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
    firstDueDate: todayDateISO(),
    notes: '',
  });
  const [rules, setRules] = useState<PayoutRuleInput[]>([
    newRule({ beneficiaryRole: 'assessoria', pct: '10', label: 'Assessoria' }),
    newRule({ beneficiaryRole: 'seller', pct: '90', label: 'Vendedor' }),
  ]);
  const [customSchedule, setCustomSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);

  const loadSaleTypes = async () => {
    const defaults: CatalogItem[] = [
      { id: '1', kind: 'sale_type', name: 'Animal inteiro', code: 'inteiro' },
      { id: '2', kind: 'sale_type', name: 'Fração', code: 'fracao' },
      { id: '3', kind: 'sale_type', name: 'Condomínio', code: 'condominio' },
    ];
    try {
      const list = await getCatalogs('sale_type');
      setSaleTypes(list.length ? list : defaults);
    } catch {
      setSaleTypes(defaults);
    }
  };

  const loadCategories = async () => {
    try {
      setCategories(await getCatalogs('animal_category'));
    } catch {
      /* opcional */
    }
  };

  const loadQuotas = async () => {
    const defaults: CatalogItem[] = [
      { id: 'q1', kind: 'share_quota', name: '100%', code: '100' },
      { id: 'q2', kind: 'share_quota', name: '50%', code: '50' },
      { id: 'q3', kind: 'share_quota', name: '25%', code: '25' },
    ];
    try {
      const list = await getCatalogs('share_quota');
      setQuotas(list.length ? list : defaults);
    } catch {
      setQuotas(defaults);
    }
  };

  useEffect(() => {
    Promise.all([
      getAnimals(),
      getClients(undefined, 'seller'),
      getClients(undefined, 'buyer'),
      getClients(undefined, 'assessor'),
      getClients(undefined, 'witness'),
      getClients(),
      getContractTemplates({ active: true }),
      loadSaleTypes(),
      loadCategories(),
      loadQuotas(),
      contractId ? getContract(contractId) : Promise.resolve(null),
    ])
      .then(([a, s, b, ass, wit, all, tpls, , , , contract]) => {
        const activeAnimals = a.filter((x) => x.status === 'ativo');
        if (contract?.animal_id) {
          const current = a.find((x) => x.id === contract.animal_id);
          setAnimals(
            current && !activeAnimals.some((x) => x.id === current.id)
              ? [...activeAnimals, current]
              : activeAnimals.length
                ? activeAnimals
                : a
          );
        } else {
          setAnimals(activeAnimals);
        }
        let sellerList = s.filter((c) => c.active);
        if (sellerIds?.length) {
          const fromAll = all.filter((c) => c.active && sellerIds.includes(c.id));
          const byId = new Map(sellerList.map((c) => [c.id, c]));
          fromAll.forEach((c) => byId.set(c.id, c));
          sellerList = Array.from(byId.values());
        }
        setSellers(sellerList);
        setBuyers(b.filter((c) => c.active));
        setAssessors(ass.filter((c) => c.active));
        setWitnesses(wit.filter((c) => c.active));
        setAllClients(all.filter((c) => c.active));
        setTemplates(tpls);

        if (contract) {
          const withCommission = contract.commission_total_pct != null;
          setHasCommission(withCommission);
          setForm({
            animalId: contract.animal_id,
            saleType: contract.sale_type,
            sharePct: contract.share_pct ?? 100,
            sellerId: contract.seller_id,
            buyerId: contract.buyer_id,
            assessorId: contract.assessor_id || '',
            templateId: contract.template_id || '',
            versoTitle: contract.template_title || '',
            versoBody: contract.template_body || '',
            lotLabel: contract.lot_label || '',
            animalCategory: contract.animal_category || '',
            quantity: String(contract.quantity ?? 1),
            commissionTotalPct: withCommission && contract.commission_total_pct != null
              ? String(contract.commission_total_pct)
              : '17',
            commissionBuyerPct: withCommission && contract.commission_buyer_pct != null
              ? String(contract.commission_buyer_pct)
              : '8.5',
            commissionSellerPct: withCommission && contract.commission_seller_pct != null
              ? String(contract.commission_seller_pct)
              : '8.5',
            witness1Id: contract.witness1_id || '',
            witness2Id: contract.witness2_id || '',
            totalAmount: String(contract.total_amount),
            paymentMethod: contract.payment_method,
            installments: contract.installments,
            firstDueDate: contract.first_due_date,
            notes: contract.notes || '',
          });
          if (contract.charges?.length) {
            const rows = contract.charges
              .slice()
              .sort((a, b) => a.installment_no - b.installment_no)
              .map((c) => ({
                amount: Number(c.amount).toFixed(2),
                dueDate: String(c.due_date).slice(0, 10),
                collector: c.collector === 'seller' ? 'seller' : 'assessoria',
              }));
            const equal = buildEqualSchedule(
              Number(contract.total_amount),
              contract.installments,
              String(contract.first_due_date).slice(0, 10)
            );
            const isEqual =
              equal.length === rows.length &&
              equal.every((r, i) => r.amount === rows[i].amount && r.dueDate === rows[i].dueDate);
            setSchedule(rows);
            setCustomSchedule(!isEqual);
          }
          if (contract.payoutRules?.length) {
            setRules(
              contract.payoutRules.map((r) =>
                newRule({
                  beneficiaryRole: r.beneficiary_role,
                  beneficiaryClientId: r.beneficiary_client_id || '',
                  label: r.label || '',
                  pct: String(r.pct),
                })
              )
            );
          }
        } else {
          const def = tpls.find((t) => t.is_default) || tpls[0];
          if (def) {
            setForm((f) => ({
              ...f,
              templateId: def.id,
              versoTitle: def.title || '',
              versoBody: def.body_text || '',
            }));
          }
        }

        if (s.filter((c) => c.active).length === 0) {
          getClients().then((list) => setSellers(list.filter((c) => c.active)));
        }
        if (b.filter((c) => c.active).length === 0) {
          getClients().then((list) => setBuyers(list.filter((c) => c.active)));
        }
      })
      .catch((e) => toastError(e.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, [toastError, contractId]);

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

  useEffect(() => {
    const n = Number(form.installments) || 0;
    const total = Number(form.totalAmount) || 0;
    if (!customSchedule) {
      setSchedule(buildEqualSchedule(total, n, form.firstDueDate));
      return;
    }
    // No modo manual só reajusta a quantidade de linhas, preservando o que já foi digitado
    setSchedule((prev) => {
      if (prev.length === n) return prev;
      const base = buildEqualSchedule(total, n, form.firstDueDate);
      return base.map((row, i) => ({
        ...(prev[i] ?? row),
        amount: prev[i]?.amount ?? row.amount,
        dueDate: prev[i]?.dueDate ?? row.dueDate,
        collector: prev[i]?.collector ?? row.collector,
      }));
    });
  }, [customSchedule, form.installments, form.totalAmount, form.firstDueDate]);

  const scheduleSum = useMemo(
    () => schedule.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [schedule]
  );
  const scheduleDiff = scheduleSum - (Number(form.totalAmount) || 0);

  const updateScheduleRow = (index: number, patch: Partial<ScheduleRow>) =>
    setSchedule((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const pctSum = useMemo(
    () => rules.reduce((s, r) => s + (Number(r.pct) || 0), 0),
    [rules]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    if (!isEdit && rules.length > 0 && pctSum > 100.01) {
      toastError('A soma dos % de repasse não pode passar de 100%');
      return;
    }

    let schedulePayload:
      | Array<{ installmentNo: number; amount: number; dueDate: string; collector: ChargeCollector }>
      | undefined;

    const rows = schedule.map((r, i) => ({
      installmentNo: i + 1,
      amount: Number(r.amount),
      dueDate: r.dueDate,
      collector: r.collector,
    }));
    if (rows.length !== Number(form.installments)) {
      toastError('O cronograma não bate com a quantidade de parcelas');
      return;
    }
    if (rows.some((r) => !(r.amount > 0) || !r.dueDate)) {
      toastError('Informe valor e vencimento em todas as parcelas');
      return;
    }
    const total = Number(form.totalAmount) || 0;
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    if (Math.abs(sum - total) > 0.02) {
      toastError(
        `A soma das parcelas (${money(sum)}) precisa ser igual ao total do contrato (${money(total)})`
      );
      return;
    }
    schedulePayload = rows;

    setSaving(true);
    try {
      const payload = {
        saleType: form.saleType,
        sharePct: Number(form.sharePct) || 100,
        sellerId: form.sellerId,
        buyerId: form.buyerId,
        assessorId: form.assessorId || null,
        templateId: form.templateId || null,
        versoTitle: form.versoTitle || null,
        versoBody: form.versoBody || null,
        lotLabel: form.lotLabel || null,
        animalCategory: form.animalCategory || null,
        quantity: Number(form.quantity) || 1,
        commissionTotalPct: hasCommission && form.commissionTotalPct !== ''
          ? Number(form.commissionTotalPct)
          : null,
        commissionBuyerPct: hasCommission && form.commissionBuyerPct !== ''
          ? Number(form.commissionBuyerPct)
          : null,
        commissionSellerPct: hasCommission && form.commissionSellerPct !== ''
          ? Number(form.commissionSellerPct)
          : null,
        witness1Id: form.witness1Id || null,
        witness2Id: form.witness2Id || null,
        totalAmount: Number(form.totalAmount),
        paymentMethod: form.paymentMethod,
        firstDueDate: form.firstDueDate,
        notes: form.notes || null,
        schedule: schedulePayload,
      };

      if (isEdit && contractId) {
        const res = await updateContract(contractId, {
          ...payload,
          installments: Number(form.installments),
          recalcCharges: true,
        });
        success(
          res.chargesRecalculated
            ? 'Contrato atualizado e parcelas recalculadas'
            : 'Contrato atualizado'
        );
        onSaved(contractId);
        onClose();
      } else {
        const payoutRules = rules
          .filter((r) => Number(r.pct) > 0)
          .map((r) => ({
            beneficiaryRole: r.beneficiaryRole,
            beneficiaryClientId: r.beneficiaryClientId || null,
            label: r.label || roleLabel[r.beneficiaryRole],
            pct: Number(r.pct),
          }));

        const res = await createContract({
          animalId: form.animalId,
          auctionId: auctionId || null,
          lotId: lotId || null,
          installments: Number(form.installments),
          payoutRules,
          ...payload,
        });
        success(
          lotId
            ? 'Arremate registrado: contrato, cobranças e repasses gerados'
            : 'Contrato, cobranças e repasses gerados'
        );
        onSaved(res.id);
        onClose();
      }
    } catch (err: any) {
      toastError(err.message || (isEdit ? 'Erro ao atualizar contrato' : 'Erro ao criar contrato'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando formulário..." />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {lotId && !isEdit && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Registrando arremate do lote — gera contrato, cobranças e repasses parcelados.
        </p>
      )}
      {isEdit && (
        <p className="rounded-xl border border-brand-beige bg-brand-off-white/80 px-3 py-2 text-sm text-brand-olive">
          Ao alterar valor, parcelas, vencimento, comprador ou forma de pagamento, as cobranças e repasses
          pendentes são recalculados automaticamente. Não é possível recalcular se já houver parcela paga.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Animal *</span>
          <select
            required
            disabled={isEdit || !!animalId || !canEditFields}
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

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Tipo de venda *</span>
          <div className="flex gap-2">
            <select
              required
              disabled={!canEditFields}
              value={form.saleType}
              onChange={(e) => set('saleType', e.target.value as SaleType)}
              className={inputClass}
            >
              {saleTypes.map((st) => (
                <option key={st.id} value={st.code || st.name}>{st.name}</option>
              ))}
              {form.saleType && !saleTypes.some((st) => (st.code || st.name) === form.saleType) && (
                <option value={form.saleType}>{form.saleType}</option>
              )}
            </select>
            {canEditFields && (
              <button
                type="button"
                title="Cadastrar tipo de venda"
                onClick={() => setAddingSaleType((v) => !v)}
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown hover:bg-brand-beige/40"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {addingSaleType && canEditFields && (
            <div className="flex gap-2 pt-1">
              <input
                value={newSaleTypeName}
                onChange={(e) => setNewSaleTypeName(e.target.value)}
                placeholder="Novo tipo de venda"
                className={inputClass}
              />
              <button
                type="button"
                className="shrink-0 rounded-xl bg-brand-brown px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const name = newSaleTypeName.trim();
                  if (!name) return toastError('Informe o nome do tipo de venda');
                  try {
                    const created = await createCatalogItem({ kind: 'sale_type', name });
                    success('Tipo de venda cadastrado');
                    setNewSaleTypeName('');
                    setAddingSaleType(false);
                    await loadSaleTypes();
                    if (created.code) set('saleType', created.code);
                  } catch (err: any) {
                    toastError(err.message || 'Erro ao cadastrar tipo de venda');
                  }
                }}
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Cotas % *</span>
          <div className="flex gap-2">
            <select
              required
              disabled={!canEditFields}
              value={String(form.sharePct)}
              onChange={(e) => set('sharePct', Number(e.target.value))}
              className={inputClass}
            >
              {quotas.map((q) => (
                <option key={q.id} value={q.code || q.name}>{q.name}</option>
              ))}
              {!quotas.some((q) => Number(q.code) === Number(form.sharePct)) && (
                <option value={form.sharePct}>{form.sharePct}%</option>
              )}
            </select>
            {canEditFields && (
              <button
                type="button"
                title="Cadastrar cota"
                onClick={() => setAddingQuota((v) => !v)}
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown hover:bg-brand-beige/40"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {addingQuota && canEditFields && (
            <div className="flex gap-2 pt-1">
              <input
                value={newQuota}
                onChange={(e) => setNewQuota(e.target.value)}
                placeholder="Ex.: 33,33"
                className={inputClass}
              />
              <button
                type="button"
                className="shrink-0 rounded-xl bg-brand-brown px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const raw = newQuota.trim().replace(',', '.');
                  const pct = Number(raw);
                  if (!(pct > 0 && pct <= 100)) return toastError('Informe um percentual entre 0 e 100');
                  try {
                    await createCatalogItem({
                      kind: 'share_quota',
                      name: `${String(pct).replace('.', ',')}%`,
                      code: String(pct),
                    });
                    success('Cota cadastrada');
                    setNewQuota('');
                    setAddingQuota(false);
                    await loadQuotas();
                    set('sharePct', pct);
                  } catch (err: any) {
                    toastError(err.message || 'Erro ao cadastrar cota');
                  }
                }}
              >
                Salvar
              </button>
            </div>
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Vendedor *</span>
          <select
            required
            disabled={((!sellerIds || sellerIds.length <= 1) && !!sellerId) || !canEditFields}
            value={form.sellerId}
            onChange={(e) => set('sellerId', e.target.value)}
            className={inputClass}
          >
            <option value="">— Selecionar —</option>
            {(sellerIds?.length ? sellers.filter((c) => sellerIds.includes(c.id)) : sellers).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {sellerIds && sellerIds.length > 1 && (
            <span className="text-xs text-brand-olive">
              Lote com {sellerIds.length} vendedores — escolha o representante deste contrato.
            </span>
          )}
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comprador *</span>
          <select required disabled={!canEditFields} value={form.buyerId} onChange={(e) => set('buyerId', e.target.value)} className={inputClass}>
            <option value="">— Selecionar —</option>
            {buyers.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Assessor (opcional)</span>
          <select disabled={!canEditFields} value={form.assessorId} onChange={(e) => set('assessorId', e.target.value)} className={inputClass}>
            <option value="">— Nenhum —</option>
            {assessors.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Nº do lote</span>
          <input disabled={!canEditFields} value={form.lotLabel} onChange={(e) => set('lotLabel', e.target.value)} className={inputClass} placeholder="06" />
        </label>
        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Categoria</span>
          <div className="flex gap-2">
            <select
              disabled={!canEditFields}
              value={form.animalCategory}
              onChange={(e) => set('animalCategory', e.target.value)}
              className={inputClass}
            >
              <option value="">— Selecionar ou cadastrar —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
              {form.animalCategory && !categories.some((c) => c.name === form.animalCategory) && (
                <option value={form.animalCategory}>{form.animalCategory}</option>
              )}
            </select>
            {canEditFields && (
              <button
                type="button"
                title="Cadastrar categoria"
                onClick={() => setAddingCategory((v) => !v)}
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown hover:bg-brand-beige/40"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {addingCategory && canEditFields && (
            <div className="flex gap-2 pt-1">
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Ex.: POTRA"
                className={inputClass}
              />
              <button
                type="button"
                className="shrink-0 rounded-xl bg-brand-brown px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const name = newCategory.trim().toUpperCase();
                  if (!name) return toastError('Informe a categoria');
                  try {
                    await createCatalogItem({ kind: 'animal_category', name, code: name });
                    success('Categoria cadastrada');
                    setNewCategory('');
                    setAddingCategory(false);
                    await loadCategories();
                    set('animalCategory', name);
                  } catch (err: any) {
                    toastError(err.message || 'Erro ao cadastrar categoria');
                  }
                }}
              >
                Salvar
              </button>
            </div>
          )}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Quantidade</span>
          <input type="number" min={0.01} step={0.01} disabled={!canEditFields} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className={inputClass} />
        </label>

        <label className="flex items-center gap-3 sm:col-span-2 rounded-xl border border-brand-beige bg-brand-off-white/50 px-3 py-3">
          <input
            type="checkbox"
            disabled={!canEditFields}
            checked={hasCommission}
            onChange={(e) => {
              const on = e.target.checked;
              setHasCommission(on);
              if (on) {
                setForm((f) => ({
                  ...f,
                  commissionTotalPct: f.commissionTotalPct || '17',
                  commissionBuyerPct: f.commissionBuyerPct || '8.5',
                  commissionSellerPct: f.commissionSellerPct || '8.5',
                }));
              }
            }}
            className="h-4 w-4 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
          />
          <span className="text-sm text-brand-dark-brown">
            Incluir comissão no contrato
            <span className="mt-0.5 block text-xs text-brand-olive">
              Gera promissória(s) de comissão no final do PDF: comissão de venda o vendedor assina; de compra o comprador assina. Beneficiária: Ariane Andrade Inteligência Agropecuária Ltda. O PDF também traz sempre a promissória do comprador em favor do vendedor pelo valor da aquisição.
            </span>
          </span>
        </label>

        {hasCommission && (
          <>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão total %</span>
              <input type="number" min={0} step={0.01} disabled={!canEditFields} value={form.commissionTotalPct} onChange={(e) => set('commissionTotalPct', e.target.value)} className={inputClass} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão comprador %</span>
              <input type="number" min={0} step={0.01} disabled={!canEditFields} value={form.commissionBuyerPct} onChange={(e) => set('commissionBuyerPct', e.target.value)} className={inputClass} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Comissão vendedor %</span>
              <input type="number" min={0} step={0.01} disabled={!canEditFields} value={form.commissionSellerPct} onChange={(e) => set('commissionSellerPct', e.target.value)} className={inputClass} />
            </label>
          </>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Testemunha 1</span>
          <select disabled={!canEditFields} value={form.witness1Id} onChange={(e) => set('witness1Id', e.target.value)} className={inputClass}>
            <option value="">— Nenhuma —</option>
            {(witnesses.length ? witnesses : allClients).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Testemunha 2</span>
          <select disabled={!canEditFields} value={form.witness2Id} onChange={(e) => set('witness2Id', e.target.value)} className={inputClass}>
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
            disabled={!canEditFields}
            value={form.totalAmount}
            onChange={(e) => set('totalAmount', e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Forma de pagamento *</span>
          <select
            disabled={!canEditFields}
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
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Parcelas (1–50) *</span>
          <input
            type="number"
            min={1}
            max={50}
            required
            disabled={!canEditFields}
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
            disabled={!canEditFields}
            value={form.firstDueDate}
            onChange={(e) => set('firstDueDate', e.target.value)}
            className={inputClass}
          />
        </label>

        <div className="space-y-2 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
                Cronograma de parcelas
              </span>
              <p className="mt-0.5 text-[11px] text-brand-olive/80">
                Por padrão as parcelas são iguais. Marque abaixo para definir valores e vencimentos
                diferentes (ex.: 29 parcelas de um valor e 3 com outro).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-brand-dark-brown">
              <input
                type="checkbox"
                disabled={!canEditFields}
                checked={customSchedule}
                onChange={(e) => setCustomSchedule(e.target.checked)}
                className="h-4 w-4 rounded border-brand-beige text-brand-brown focus:ring-brand-beige"
              />
              Personalizar parcelas
            </label>
          </div>

          {customSchedule && (
            <div className="space-y-2 rounded-xl border border-brand-beige bg-brand-off-white/40 p-3">
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {schedule.map((row, index) => (
                  <div key={index} className="grid grid-cols-[38px_1fr_1fr] items-center gap-2">
                    <span className="text-xs font-medium text-brand-olive">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      disabled={!canEditFields}
                      value={row.amount}
                      onChange={(e) => updateScheduleRow(index, { amount: e.target.value })}
                      className={`${inputClass} py-1.5`}
                      placeholder="Valor"
                    />
                    <input
                      type="date"
                      disabled={!canEditFields}
                      value={row.dueDate}
                      onChange={(e) => updateScheduleRow(index, { dueDate: e.target.value })}
                      className={`${inputClass} py-1.5`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-beige/70 pt-2">
                <p className="text-xs text-brand-olive">
                  Soma: <strong className="text-brand-dark-brown">{money(scheduleSum)}</strong> de{' '}
                  {money(Number(form.totalAmount) || 0)}
                  {Math.abs(scheduleDiff) > 0.02 && (
                    <span className="text-red-600">
                      {' '}· faltam {money(Math.abs(scheduleDiff))}
                      {scheduleDiff > 0 ? ' a menos' : ''}
                    </span>
                  )}
                </p>
                {canEditFields && (
                  <button
                    type="button"
                    onClick={() =>
                      setSchedule((prev) =>
                        buildEqualSchedule(
                          Number(form.totalAmount) || 0,
                          Number(form.installments) || 0,
                          form.firstDueDate
                        ).map((row, i) => ({ ...row, collector: prev[i]?.collector ?? row.collector }))
                      )
                    }
                    className="rounded-lg border border-brand-beige bg-white px-2.5 py-1 text-xs font-medium text-brand-brown hover:bg-brand-beige/40"
                  >
                    Distribuir igualmente
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-brand-beige bg-brand-off-white/40 p-3">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
                Quem cobra cada parcela?
              </span>
              <p className="mt-0.5 text-[11px] text-brand-olive/80">
                Defina quais parcelas a assessoria fatura e quais ficam com o vendedor. Só as parcelas
                da assessoria entram nas cobranças e no dashboard.
              </p>
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {schedule.map((row, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 sm:grid-cols-[140px_1fr]"
                >
                  <span className="text-xs text-brand-brown">
                    Parcela {index + 1} · {form.paymentMethod.toUpperCase()}
                  </span>
                  <select
                    disabled={!canEditFields}
                    value={row.collector}
                    onChange={(e) =>
                      updateScheduleRow(index, { collector: e.target.value as ChargeCollector })
                    }
                    className={`${inputClass} py-1.5`}
                  >
                    {(Object.entries(CHARGE_COLLECTOR_LABELS) as [ChargeCollector, string][]).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </div>
              ))}
            </div>
            <p className="border-t border-brand-beige/70 pt-2 text-xs text-brand-olive">
              Assessoria cobra{' '}
              <strong className="text-brand-dark-brown">
                {schedule.filter((r) => r.collector === 'assessoria').length}
              </strong>{' '}
              de {schedule.length} parcelas
            </p>
          </div>
        </div>

        <label className="block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Observações</span>
          <textarea disabled={!canEditFields} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="rounded-2xl border border-brand-beige bg-brand-off-white/50 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-brand-dark-brown">Verso do contrato</h3>
          <p className="text-xs text-brand-olive">
            O texto abaixo é uma cópia do modelo, guardada neste contrato. Alterar o modelo depois
            não muda contratos já criados — use "Recarregar do modelo" para trazer a versão atual.
          </p>
        </div>
        <label className="block space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Modelo do verso *</span>
            {canEditFields && (
              <button
                type="button"
                onClick={() => {
                  const tpl = templates.find((t) => t.id === form.templateId);
                  if (!tpl) {
                    toastError('Selecione um modelo primeiro');
                    return;
                  }
                  setForm((f) => ({
                    ...f,
                    versoTitle: tpl.title || '',
                    versoBody: tpl.body_text || '',
                  }));
                  success('Texto do verso atualizado com a versão atual do modelo');
                }}
                className="rounded-lg border border-brand-beige bg-white px-2.5 py-1 text-xs font-medium text-brand-brown hover:bg-brand-beige/40"
              >
                Recarregar do modelo
              </button>
            )}
          </div>
          <select
            required
            disabled={!canEditFields}
            value={form.templateId}
            onChange={(e) => {
              const id = e.target.value;
              const tpl = templates.find((t) => t.id === id);
              if (tpl) {
                setForm((f) => ({
                  ...f,
                  templateId: id,
                  versoTitle: tpl.title || '',
                  versoBody: tpl.body_text || '',
                }));
              } else {
                set('templateId', id);
              }
            }}
            className={inputClass}
          >
            <option value="">— Selecionar modelo —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.is_default ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Título do verso</span>
          <input
            disabled={!canEditFields}
            value={form.versoTitle}
            onChange={(e) => set('versoTitle', e.target.value)}
            className={inputClass}
            placeholder={DEFAULT_CONTRACT_DOCUMENT_TITLE}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Texto do verso (cláusulas)</span>
          <textarea
            disabled={!canEditFields}
            rows={10}
            value={form.versoBody}
            onChange={(e) => set('versoBody', e.target.value)}
            className={`${inputClass} font-mono text-xs leading-relaxed`}
            placeholder="Cole ou edite aqui as cláusulas do verso deste contrato..."
          />
        </label>
      </div>

      {!isEdit && (
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
          {canEditFields && (
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
                  disabled={!canEditFields}
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
                  disabled={!canEditFields}
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
                  disabled={!canEditFields}
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
                  disabled={!canEditFields}
                  value={r.label}
                  onChange={(e) =>
                    setRules((list) => list.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                  }
                  className={inputClass}
                />
              </label>
              <div className="flex items-end sm:col-span-1">
                {canEditFields && rules.length > 1 && (
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
      )}

      <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
        {canEditFields && (
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
            {saving
              ? (isEdit ? 'Salvando...' : 'Gerando...')
              : isEdit
                ? 'Salvar alterações'
                : lotId
                  ? 'Confirmar arremate'
                  : 'Gerar contrato, cobranças e repasses'}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
