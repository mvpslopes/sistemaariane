import { useEffect, useState } from 'react';
import {
  createContract,
  getAnimals,
  getClients,
  type Animal,
  type Client,
  type PaymentMethod,
  type SaleType,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';

interface ContractFormProps {
  animalId?: string | null;
  onClose: () => void;
  onSaved: (contractId: string) => void;
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige disabled:bg-brand-off-white';

export default function ContractForm({ animalId, onClose, onSaved }: ContractFormProps) {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [sellers, setSellers] = useState<Client[]>([]);
  const [buyers, setBuyers] = useState<Client[]>([]);
  const [assessors, setAssessors] = useState<Client[]>([]);
  const [form, setForm] = useState({
    animalId: animalId || '',
    saleType: 'inteiro' as SaleType,
    sharePct: 100,
    sellerId: '',
    buyerId: '',
    assessorId: '',
    totalAmount: '',
    paymentMethod: 'boleto' as PaymentMethod,
    installments: 1,
    firstDueDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  useEffect(() => {
    Promise.all([
      getAnimals(),
      getClients(undefined, 'seller'),
      getClients(undefined, 'buyer'),
      getClients(undefined, 'assessor'),
    ])
      .then(([a, s, b, ass]) => {
        setAnimals(a.filter((x) => x.status === 'ativo'));
        setSellers(s.filter((c) => c.active));
        setBuyers(b.filter((c) => c.active));
        setAssessors(ass.filter((c) => c.active));
        // fallback: if no sellers tagged yet, show all active clients
        if (s.filter((c) => c.active).length === 0) {
          getClients().then((all) => setSellers(all.filter((c) => c.active)));
        }
        if (b.filter((c) => c.active).length === 0) {
          getClients().then((all) => setBuyers(all.filter((c) => c.active)));
        }
      })
      .catch((e) => toastError(e.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, [toastError]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await createContract({
        animalId: form.animalId,
        saleType: form.saleType,
        sharePct: form.saleType === 'inteiro' ? 100 : Number(form.sharePct),
        sellerId: form.sellerId,
        buyerId: form.buyerId,
        assessorId: form.assessorId || null,
        totalAmount: Number(form.totalAmount),
        paymentMethod: form.paymentMethod,
        installments: Number(form.installments),
        firstDueDate: form.firstDueDate,
        notes: form.notes || null,
      });
      success('Contrato e cobranças gerados');
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
      <div className="grid gap-4 sm:grid-cols-2">
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
          <select required disabled={!canWrite} value={form.sellerId} onChange={(e) => set('sellerId', e.target.value)} className={inputClass}>
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
          <textarea disabled={!canWrite} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
        {canWrite && (
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
            {saving ? 'Gerando...' : 'Gerar contrato e cobranças'}
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  );
}
