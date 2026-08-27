import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  createHarasFinance,
  deleteHarasFinance,
  getAnimals,
  getHarasFinance,
  updateHarasFinance,
  type Animal,
  type HarasFinanceEntry,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import RowActions from '../../components/RowActions';
import { formatDateBR } from '../../utils/dateTime';
import {
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_INCOME_CATEGORIES,
  financeCategoryLabel,
  moneyBRL,
} from '../../constants/haras';
import { HarasPropertyFilter, HarasPropertySelect, useHarasProperties } from '../../components/HarasPropertySelect';

const today = () => new Date().toISOString().slice(0, 10);

type FormState = {
  propertyId: string;
  entryType: 'receita' | 'despesa';
  category: string;
  amount: number;
  entryDate: string;
  description: string;
  animalId: string;
  notes: string;
};

const emptyForm: FormState = {
  propertyId: '',
  entryType: 'despesa',
  category: 'outros',
  amount: 0,
  entryDate: today(),
  description: '',
  animalId: '',
  notes: '',
};

export default function HarasFinancePage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const { properties } = useHarasProperties();
  const [items, setItems] = useState<HarasFinanceEntry[]>([]);
  const [totals, setTotals] = useState({ income: 0, expense: 0, balance: 0 });
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<HarasFinanceEntry | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, animalList] = await Promise.all([
        getHarasFinance({
          q: q || undefined,
          type: type || undefined,
          from: from || undefined,
          to: to || undefined,
          propertyId: propertyId || undefined,
        }),
        getAnimals(),
      ]);
      setItems(data.items);
      setTotals(data.totals);
      setAnimals(animalList);
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar financeiro do haras');
    } finally {
      setLoading(false);
    }
  }, [q, type, from, to, propertyId, toastError]);

  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const categories = form.entryType === 'receita' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      const key = `${i.entryType}:${i.category}`;
      map.set(key, (map.get(key) || 0) + i.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const openNew = (entryType: 'receita' | 'despesa' = 'despesa') => {
    setEditItem(null);
    setForm({
      ...emptyForm,
      entryType,
      category: 'outros',
      entryDate: today(),
      propertyId: propertyId || properties[0]?.id || '',
    });
    setModalOpen(true);
  };

  const openEdit = (item: HarasFinanceEntry) => {
    setEditItem(item);
    setForm({
      propertyId: item.propertyId || '',
      entryType: item.entryType,
      category: item.category,
      amount: item.amount,
      entryDate: item.entryDate,
      description: item.description,
      animalId: item.animalId || '',
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.propertyId || !form.description.trim() || !form.entryDate || !form.amount) {
      toastError('Haras, descrição, data e valor são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        entryType: form.entryType,
        category: form.category,
        amount: Number(form.amount),
        entryDate: form.entryDate,
        description: form.description.trim(),
        animalId: form.animalId || null,
        notes: form.notes.trim() || null,
      };
      if (editItem) {
        await updateHarasFinance(editItem.id, payload);
        success('Lançamento atualizado');
      } else {
        await createHarasFinance(payload);
        success('Lançamento registrado');
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: HarasFinanceEntry) => {
    if (!canDelete || !window.confirm('Excluir este lançamento?')) return;
    try {
      await deleteHarasFinance(item.id);
      success('Lançamento excluído');
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  if (loading && items.length === 0) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Receitas e despesas da propriedade — separado do financeiro da assessoria e dos leilões. Diárias de hospedagem encerrada entram automaticamente.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Receitas</p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">{moneyBRL(totals.income)}</p>
        </div>
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Despesas</p>
          <p className="mt-1 text-xl font-semibold text-red-800">{moneyBRL(totals.expense)}</p>
        </div>
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Saldo</p>
          <p className={`mt-1 text-xl font-semibold ${totals.balance >= 0 ? 'text-brand-dark-brown' : 'text-red-800'}`}>
            {moneyBRL(totals.balance)}
          </p>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <h3 className="mb-2 text-sm font-semibold text-brand-dark-brown">Por categoria (filtro atual)</h3>
          <ul className="grid gap-1 sm:grid-cols-2">
            {byCategory.map(([key, value]) => {
              const [entryType, category] = key.split(':');
              return (
                <li key={key} className="flex justify-between text-sm">
                  <span className="text-brand-olive">
                    {entryType === 'receita' ? 'Receita' : 'Despesa'} · {financeCategoryLabel(entryType, category)}
                  </span>
                  <span className="font-medium text-brand-dark-brown">{moneyBRL(value)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar descrição ou animal..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <input type="date" className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        <HarasPropertyFilter value={propertyId} onChange={setPropertyId} properties={properties} />
        {canCreate && (
          <>
            <AppButton onClick={() => openNew('receita')} variant="secondary">
              Receita
            </AppButton>
            <AppButton onClick={() => openNew('despesa')} className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" /> Despesa
            </AppButton>
          </>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoria</th>
              <th className="px-4 py-3 font-medium text-right">Valor</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-brand-olive">
                  Nenhum lançamento no período
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-brand-beige/70">
                <td className="px-4 py-3">{formatDateBR(item.entryDate)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{item.description}</p>
                  {item.propertyName && <p className="text-xs text-brand-olive">{item.propertyName}</p>}
                  {item.animalName && <p className="text-xs text-brand-olive">{item.animalName}</p>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{financeCategoryLabel(item.entryType, item.category)}</td>
                <td className={`px-4 py-3 text-right font-medium ${item.entryType === 'receita' ? 'text-emerald-800' : 'text-red-800'}`}>
                  {item.entryType === 'receita' ? '+' : '−'} {moneyBRL(item.amount)}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActions
                    onEdit={canUpdate ? () => openEdit(item) : undefined}
                    onDelete={canDelete ? () => remove(item) : undefined}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editItem ? 'Editar lançamento' : form.entryType === 'receita' ? 'Nova receita' : 'Nova despesa'} onClose={() => setModalOpen(false)} size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          <HarasPropertySelect
            value={form.propertyId}
            onChange={(v) => setForm({ ...form, propertyId: v })}
            properties={properties}
          />
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Tipo</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.entryType}
              onChange={(e) =>
                setForm({ ...form, entryType: e.target.value as FormState['entryType'], category: 'outros' })
              }
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Categoria</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Descrição *</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Data *</span>
            <input type="date" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Valor (R$) *</span>
            <input type="number" min="0.01" step="0.01" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Animal (opcional)</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.animalId} onChange={(e) => setForm({ ...form, animalId: e.target.value })}>
              <option value="">Não vincular</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Observações</span>
            <textarea rows={2} className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <AppButton onClick={save} loading={saving}>
            Salvar
          </AppButton>
          <AppButton variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </AppButton>
        </div>
      </Modal>
    </div>
  );
}
