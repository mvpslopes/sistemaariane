import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, LogOut } from 'lucide-react';
import {
  createHarasStay,
  deleteHarasStay,
  getAnimals,
  getClients,
  getHarasStays,
  updateHarasStay,
  type Animal,
  type Client,
  type HarasStay,
  type HarasStayInput,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import RowActions, { RowActionButton } from '../../components/RowActions';
import { formatDateBR } from '../../utils/dateTime';
import { moneyBRL, stayDays } from '../../constants/haras';
import { HarasPropertyFilter, HarasPropertySelect, useHarasProperties } from '../../components/HarasPropertySelect';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: HarasStayInput = {
  propertyId: '',
  animalId: '',
  ownerClientId: '',
  stall: '',
  checkIn: today(),
  checkOut: '',
  dailyRate: 0,
  notes: '',
};

export default function HarasStaysPage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const { properties } = useHarasProperties();
  const [items, setItems] = useState<HarasStay[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [people, setPeople] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('hospedado');
  const [propertyId, setPropertyId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<HarasStay | null>(null);
  const [form, setForm] = useState<HarasStayInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [hostedIds, setHostedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, animalList, clientList, hostedList] = await Promise.all([
        getHarasStays({ q: q || undefined, status: status || undefined, propertyId: propertyId || undefined }),
        getAnimals(),
        getClients(),
        getHarasStays({ status: 'hospedado' }),
      ]);
      setItems(list);
      setAnimals(animalList);
      setPeople(clientList);
      setHostedIds(new Set(hostedList.map((h) => h.animalId)));
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar hospedagem');
    } finally {
      setLoading(false);
    }
  }, [q, status, propertyId, toastError]);

  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const hosted = useMemo(() => items.filter((i) => i.status === 'hospedado'), [items]);
  const occupancyValue = useMemo(
    () => hosted.reduce((s, i) => s + i.estimatedTotal, 0),
    [hosted]
  );

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, checkIn: today(), propertyId: propertyId || properties[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (item: HarasStay) => {
    setEditItem(item);
    setForm({
      propertyId: item.propertyId || '',
      animalId: item.animalId,
      ownerClientId: item.ownerClientId || '',
      stall: item.stall || '',
      checkIn: item.checkIn,
      checkOut: item.checkOut || '',
      dailyRate: item.dailyRate,
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const checkout = async (item: HarasStay) => {
    if (!canUpdate || !window.confirm(`Encerrar a hospedagem de ${item.animalName}?`)) return;
    try {
      await updateHarasStay(item.id, { checkOut: today(), status: 'encerrado' });
      success(
        item.dailyRate > 0
          ? 'Hospedagem encerrada e receita de diárias lançada no financeiro do haras'
          : 'Hospedagem encerrada'
      );
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao encerrar');
    }
  };

  const save = async () => {
    if (!form.propertyId || !form.animalId || !form.checkIn) {
      toastError('Haras, animal e data de entrada são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload: HarasStayInput = {
        ...form,
        ownerClientId: form.ownerClientId || null,
        stall: form.stall?.trim() || null,
        checkOut: form.checkOut?.trim() || null,
        notes: form.notes?.trim() || null,
        dailyRate: Number(form.dailyRate) || 0,
      };
      if (editItem) {
        await updateHarasStay(editItem.id, payload);
        success('Hospedagem atualizada');
      } else {
        await createHarasStay(payload);
        success('Hospedagem registrada');
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: HarasStay) => {
    if (!canDelete || !window.confirm('Excluir este registro de hospedagem?')) return;
    try {
      await deleteHarasStay(item.id);
      success('Registro excluído');
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  const previewDays = stayDays(form.checkIn || today(), form.checkOut || null);

  if (loading && items.length === 0) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Animais hospedados, baia, diária e estimativa do período. Ao encerrar com diária preenchida, a receita entra no financeiro do haras.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Hospedados agora</p>
          <p className="mt-1 text-xl font-semibold text-brand-dark-brown">{hosted.length}</p>
        </div>
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Baias ocupadas</p>
          <p className="mt-1 text-xl font-semibold text-brand-dark-brown">
            {new Set(hosted.map((h) => h.stall).filter(Boolean)).size}
          </p>
        </div>
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">A receber (abertos)</p>
          <p className="mt-1 text-xl font-semibold text-brand-dark-brown">{moneyBRL(occupancyValue)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar animal, baia ou dono..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="hospedado">Hospedados</option>
          <option value="encerrado">Encerrados</option>
          <option value="">Todos</option>
        </select>
        <HarasPropertyFilter value={propertyId} onChange={setPropertyId} properties={properties} />
        {canCreate && (
          <AppButton onClick={openNew} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova hospedagem
          </AppButton>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Animal</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Baia</th>
              <th className="px-4 py-3 font-medium">Entrada</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Diárias</th>
              <th className="px-4 py-3 font-medium">Estimado</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                  Nenhuma hospedagem encontrada
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-brand-beige/70">
                <td className="px-4 py-3">
                  <p className="font-medium">
                    <Link to={`/app/animais/${item.animalId}`} className="hover:underline">
                      {item.animalName}
                    </Link>
                  </p>
                  <p className="text-xs text-brand-olive">
                    {[item.propertyName, item.ownerName || 'Sem dono informado'].filter(Boolean).join(' · ')}
                  </p>
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">{item.stall || '—'}</td>
                <td className="px-4 py-3">{formatDateBR(item.checkIn)}</td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {item.days} × {moneyBRL(item.dailyRate)}
                </td>
                <td className="px-4 py-3 font-medium">{moneyBRL(item.estimatedTotal)}</td>
                <td className="px-4 py-3 text-right">
                  <RowActions
                    onEdit={canUpdate ? () => openEdit(item) : undefined}
                    onDelete={canDelete ? () => remove(item) : undefined}
                  >
                    {canUpdate && item.status === 'hospedado' && (
                      <RowActionButton onClick={() => checkout(item)} title="Encerrar" aria-label="Encerrar">
                        <LogOut className="h-3.5 w-3.5" />
                        Encerrar
                      </RowActionButton>
                    )}
                  </RowActions>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editItem ? 'Editar hospedagem' : 'Nova hospedagem'} onClose={() => setModalOpen(false)} size="lg">
        <div className="grid gap-3 sm:grid-cols-2">
          <HarasPropertySelect
            value={form.propertyId || ''}
            onChange={(v) => setForm({ ...form, propertyId: v })}
            properties={properties}
          />
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Animal *</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.animalId} onChange={(e) => setForm({ ...form, animalId: e.target.value })}>
              <option value="">Selecione...</option>
              {animals.map((a) => {
                const busy = hostedIds.has(a.id) && a.id !== editItem?.animalId;
                return (
                  <option key={a.id} value={a.id} disabled={busy}>
                    {a.name}
                    {busy ? ' (já hospedado)' : ''}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Dono / responsável</span>
            <select className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.ownerClientId || ''} onChange={(e) => setForm({ ...form, ownerClientId: e.target.value })}>
              <option value="">Não informado</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Baia</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.stall || ''} onChange={(e) => setForm({ ...form, stall: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Diária (R$)</span>
            <input type="number" min="0" step="0.01" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: Number(e.target.value) })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Entrada *</span>
            <input type="date" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Saída</span>
            <input type="date" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.checkOut || ''} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
          </label>
          <p className="text-sm text-brand-olive sm:col-span-2">
            Período estimado: {previewDays} diária(s) · {moneyBRL(previewDays * (Number(form.dailyRate) || 0))}
          </p>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Observações</span>
            <textarea rows={2} className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
