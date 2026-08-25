import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  createHarasStockItem,
  deleteHarasStockItem,
  getAnimals,
  getHarasStock,
  getHarasStockMoves,
  moveHarasStock,
  updateHarasStockItem,
  type Animal,
  type HarasStockItem,
  type HarasStockMove,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import { formatDateTimeBR } from '../../utils/dateTime';
import { moneyBRL, STOCK_CATEGORIES, STOCK_UNITS, stockCategoryLabel } from '../../constants/haras';
import { HarasPropertyFilter, HarasPropertySelect, useHarasProperties } from '../../components/HarasPropertySelect';

type ItemForm = {
  propertyId: string;
  name: string;
  category: HarasStockItem['category'];
  unit: string;
  quantity: number;
  minQuantity: number;
  unitCost: number | null;
  location: string;
  notes: string;
};

const emptyItem: ItemForm = {
  propertyId: '',
  name: '',
  category: 'insumo',
  unit: 'un',
  quantity: 0,
  minQuantity: 0,
  unitCost: null,
  location: '',
  notes: '',
};

export default function HarasStockPage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const { properties } = useHarasProperties();
  const [items, setItems] = useState<HarasStockItem[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<HarasStockItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItem);
  const [saving, setSaving] = useState(false);
  const [moveItem, setMoveItem] = useState<HarasStockItem | null>(null);
  const [moveType, setMoveType] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [moveQty, setMoveQty] = useState('1');
  const [moveReason, setMoveReason] = useState('');
  const [moveAnimalId, setMoveAnimalId] = useState('');
  const [moves, setMoves] = useState<HarasStockMove[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, animalList] = await Promise.all([
        getHarasStock({ q: q || undefined, category: category || undefined, propertyId: propertyId || undefined }),
        getAnimals(),
      ]);
      setItems(list);
      setAnimals(animalList.filter((a) => a.status === 'ativo'));
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  }, [q, category, propertyId, toastError]);

  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const low = useMemo(() => items.filter((i) => i.lowStock).length, [items]);

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyItem, propertyId: propertyId || properties[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (item: HarasStockItem) => {
    setEditItem(item);
    setForm({
      propertyId: item.propertyId || '',
      name: item.name,
      category: item.category,
      unit: item.unit,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unitCost: item.unitCost ?? null,
      location: item.location || '',
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.propertyId) {
      toastError('Nome e haras são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        propertyId: form.propertyId,
        name: form.name.trim(),
        category: form.category,
        unit: form.unit,
        quantity: form.quantity,
        minQuantity: form.minQuantity,
        unitCost: form.unitCost,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editItem) {
        await updateHarasStockItem(editItem.id, payload);
        success('Item atualizado');
      } else {
        await createHarasStockItem(payload);
        success('Item cadastrado');
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const openMove = async (item: HarasStockItem) => {
    setMoveItem(item);
    setMoveType('entrada');
    setMoveQty('1');
    setMoveReason('');
    setMoveAnimalId('');
    try {
      setMoves(await getHarasStockMoves(item.id));
    } catch {
      setMoves([]);
    }
  };

  const saveMove = async () => {
    if (!moveItem) return;
    const qty = Number(moveQty);
    if (!qty || qty <= 0) {
      toastError('Informe uma quantidade válida');
      return;
    }
    setSaving(true);
    try {
      await moveHarasStock(moveItem.id, {
        moveType,
        quantity: qty,
        reason: moveReason.trim() || undefined,
        animalId: moveAnimalId || undefined,
      });
      success('Movimentação registrada');
      setMoveItem(null);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao movimentar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: HarasStockItem) => {
    if (!canDelete || !window.confirm(`Excluir ${item.name} e o histórico de movimentações?`)) return;
    try {
      await deleteHarasStockItem(item.id);
      success('Item excluído');
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  if (loading && items.length === 0) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Medicamentos, ração, insumos e materiais. Use entrada/saída para alterar o saldo — o cadastro não edita quantidade direto.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Itens</p>
          <p className="mt-1 text-xl font-semibold text-brand-dark-brown">{items.length}</p>
        </div>
        <div className={`rounded-2xl border bg-white p-4 shadow-card ${low ? 'border-red-200' : 'border-brand-beige'}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Abaixo do mínimo</p>
          <p className={`mt-1 text-xl font-semibold ${low ? 'text-red-800' : 'text-brand-dark-brown'}`}>{low}</p>
        </div>
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Valor estimado</p>
          <p className="mt-1 text-xl font-semibold text-brand-dark-brown">
            {moneyBRL(items.reduce((s, i) => s + i.quantity * (i.unitCost || 0), 0))}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar item ou local..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {STOCK_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <HarasPropertyFilter value={propertyId} onChange={setPropertyId} properties={properties} />
        {canCreate && (
          <AppButton onClick={openNew} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo item
          </AppButton>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Categoria</th>
              <th className="px-4 py-3 font-medium">Saldo</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Mínimo</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-brand-olive">
                  Nenhum item no estoque
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-brand-beige/70">
                <td className="px-4 py-3">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-brand-olive">
                    {[item.propertyName, item.location || 'Sem local'].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{stockCategoryLabel(item.category)}</td>
                <td className={`px-4 py-3 ${item.lowStock ? 'font-semibold text-red-700' : ''}`}>
                  {item.quantity} {item.unit}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {item.minQuantity} {item.unit}
                </td>
                <td className="px-4 py-3 text-right">
                  {canUpdate && (
                    <button type="button" onClick={() => openMove(item)} className="mr-2 text-xs font-medium text-brand-brown hover:underline">
                      Movimentar
                    </button>
                  )}
                  {canUpdate && (
                    <button type="button" onClick={() => openEdit(item)} className="mr-2 text-xs font-medium text-brand-brown hover:underline">
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button type="button" onClick={() => remove(item)} className="text-xs font-medium text-red-600 hover:underline">
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editItem ? 'Editar item' : 'Novo item de estoque'} onClose={() => setModalOpen(false)} size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          <HarasPropertySelect
            value={form.propertyId}
            onChange={(v) => setForm({ ...form, propertyId: v })}
            properties={properties}
          />
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Nome *</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Categoria</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as HarasStockItem['category'] })}>
              {STOCK_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Unidade</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {STOCK_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          {!editItem && (
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Saldo inicial</span>
              <input type="number" min="0" step="0.001" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </label>
          )}
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Estoque mínimo</span>
            <input type="number" min="0" step="0.001" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.minQuantity} onChange={(e) => setForm({ ...form, minQuantity: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Custo unitário (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.unitCost ?? ''}
              onChange={(e) => setForm({ ...form, unitCost: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Local</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Farmácia, silo..." />
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

      <Modal open={!!moveItem} title={moveItem ? `Movimentar ${moveItem.name}` : ''} onClose={() => setMoveItem(null)} size="lg">
        {moveItem && (
          <>
            <p className="mb-3 text-sm text-brand-olive">
              Saldo atual: <strong className="text-brand-dark-brown">{moveItem.quantity} {moveItem.unit}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">Tipo</span>
                <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={moveType} onChange={(e) => setMoveType(e.target.value as typeof moveType)}>
                  <option value="entrada">Entrada</option>
                  <option value="saida">Saída</option>
                  <option value="ajuste">Ajuste (definir saldo)</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">{moveType === 'ajuste' ? 'Novo saldo' : 'Quantidade'}</span>
                <input type="number" min="0.001" step="0.001" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium uppercase text-brand-olive">Animal (opcional, na saída)</span>
                <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={moveAnimalId} onChange={(e) => setMoveAnimalId(e.target.value)}>
                  <option value="">Não informar</option>
                  {animals.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm sm:col-span-2">
                <span className="text-xs font-medium uppercase text-brand-olive">Motivo</span>
                <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={moveReason} onChange={(e) => setMoveReason(e.target.value)} placeholder="Compra, consumo, perda..." />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <AppButton onClick={saveMove} loading={saving}>
                Confirmar
              </AppButton>
              <AppButton variant="secondary" onClick={() => setMoveItem(null)}>
                Fechar
              </AppButton>
            </div>
            {moves.length > 0 && (
              <div className="mt-5 border-t border-brand-beige pt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-brand-olive">Últimas movimentações</p>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {moves.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-brand-dark-brown">
                      <span>
                        {m.moveType} {m.quantity} {moveItem.unit}
                        {m.animalName ? ` · ${m.animalName}` : ''}
                        {m.reason ? ` · ${m.reason}` : ''}
                      </span>
                      <span className="shrink-0 text-xs text-brand-olive">{m.createdAt ? formatDateTimeBR(m.createdAt) : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
