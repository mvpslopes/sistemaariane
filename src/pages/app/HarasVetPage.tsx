import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import {
  createHarasVetRecord,
  deleteHarasVetRecord,
  getAnimals,
  getHarasVetRecords,
  updateHarasVetRecord,
  type Animal,
  type HarasVetInput,
  type HarasVetRecord,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import RowActions from '../../components/RowActions';
import { formatDateBR } from '../../utils/dateTime';
import { VET_TYPES, vetTypeLabel, moneyBRL, type VetRecordType } from '../../constants/haras';
import { HarasPropertyFilter, HarasPropertySelect, useHarasProperties } from '../../components/HarasPropertySelect';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm: HarasVetInput = {
  propertyId: '',
  animalId: '',
  recordType: 'vacina',
  title: '',
  product: '',
  recordDate: today(),
  nextDueDate: '',
  veterinarian: '',
  resultNotes: '',
  cost: null,
  notes: '',
};

export default function HarasVetPage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const { properties } = useHarasProperties();
  const [items, setItems] = useState<HarasVetRecord[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<HarasVetRecord | null>(null);
  const [form, setForm] = useState<HarasVetInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, animalList] = await Promise.all([
        getHarasVetRecords({ q: q || undefined, type: type || undefined, propertyId: propertyId || undefined }),
        getAnimals(),
      ]);
      setItems(list);
      setAnimals(animalList);
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar controle veterinário');
    } finally {
      setLoading(false);
    }
  }, [q, type, propertyId, toastError]);

  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const overdue = useMemo(() => {
    const now = today();
    return items.filter((i) => i.nextDueDate && i.nextDueDate < now).length;
  }, [items]);

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm, recordDate: today(), propertyId: propertyId || properties[0]?.id || '' });
    setModalOpen(true);
  };

  const openEdit = (item: HarasVetRecord) => {
    setEditItem(item);
    setForm({
      propertyId: item.propertyId || '',
      animalId: item.animalId,
      recordType: item.recordType,
      title: item.title,
      product: item.product || '',
      recordDate: item.recordDate,
      nextDueDate: item.nextDueDate || '',
      veterinarian: item.veterinarian || '',
      resultNotes: item.resultNotes || '',
      cost: item.cost,
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.propertyId || !form.animalId || !form.title.trim() || !form.recordDate) {
      toastError('Haras, animal, título e data são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        product: form.product?.trim() || null,
        nextDueDate: form.nextDueDate?.trim() || null,
        veterinarian: form.veterinarian?.trim() || null,
        resultNotes: form.resultNotes?.trim() || null,
        notes: form.notes?.trim() || null,
        cost: form.cost === null || form.cost === undefined || Number.isNaN(Number(form.cost)) ? null : Number(form.cost),
      };
      if (editItem) {
        await updateHarasVetRecord(editItem.id, payload);
        success('Registro atualizado');
      } else {
        await createHarasVetRecord(payload);
        success('Registro veterinário salvo');
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: HarasVetRecord) => {
    if (!canDelete || !window.confirm('Excluir este registro veterinário?')) return;
    try {
      await deleteHarasVetRecord(item.id);
      success('Registro excluído');
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  if (loading && items.length === 0) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Vacinas, vermífugos, exames e tratamentos do plantel. A próxima dose gera alerta quando estiver atrasada.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Registros" value={String(items.length)} />
        <Kpi label="Com próxima dose" value={String(items.filter((i) => i.nextDueDate).length)} />
        <Kpi label="Atrasados" value={String(overdue)} warn={overdue > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar animal, produto, veterinário..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Todos os tipos</option>
          {VET_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        <HarasPropertyFilter value={propertyId} onChange={setPropertyId} properties={properties} />
        {canCreate && (
          <AppButton onClick={openNew} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo registro
          </AppButton>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Animal</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Tipo</th>
              <th className="px-4 py-3 font-medium">Procedimento</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Próxima</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Custo</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
                    {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                  Nenhum registro veterinário
                </td>
              </tr>
            )}
            {items.map((item) => {
              const late = item.nextDueDate && item.nextDueDate < today();
              return (
                <tr key={item.id} className="border-t border-brand-beige/70">
                  <td className="px-4 py-3">{formatDateBR(item.recordDate)}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/app/animais/${item.animalId}`} className="hover:underline">
                      {item.animalName}
                    </Link>
                    {item.propertyName && (
                      <p className="text-xs text-brand-olive">{item.propertyName}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{vetTypeLabel(item.recordType)}</td>
                  <td className="px-4 py-3">
                    <p>{item.title}</p>
                    {item.product && <p className="text-xs text-brand-olive">{item.product}</p>}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {item.nextDueDate ? (
                      <span className={late ? 'font-medium text-red-700' : ''}>
                        {formatDateBR(item.nextDueDate)}
                        {late ? ' · atrasado' : ''}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {item.cost != null ? moneyBRL(item.cost) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <RowActions
                      onEdit={canUpdate ? () => openEdit(item) : undefined}
                      onDelete={canDelete ? () => remove(item) : undefined}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editItem ? 'Editar registro' : 'Novo registro veterinário'} onClose={() => setModalOpen(false)} size="lg">
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
              {animals.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Tipo</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.recordType}
              onChange={(e) => setForm({ ...form, recordType: e.target.value as VetRecordType })}
            >
              {VET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Título *</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Vacina influenza" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Produto / lote</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.product || ''} onChange={(e) => setForm({ ...form, product: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Data *</span>
            <input type="date" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Próxima dose / retorno</span>
            <input type="date" className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.nextDueDate || ''} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Veterinário</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.veterinarian || ''} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Custo (R$)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.cost ?? ''}
              onChange={(e) => setForm({ ...form, cost: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Resultado / laudo</span>
            <input className="w-full rounded-xl border border-brand-beige px-3 py-2" value={form.resultNotes || ''} onChange={(e) => setForm({ ...form, resultNotes: e.target.value })} />
          </label>
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

function Kpi({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-card ${warn ? 'border-red-200' : 'border-brand-beige'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${warn ? 'text-red-800' : 'text-brand-dark-brown'}`}>{value}</p>
    </div>
  );
}
