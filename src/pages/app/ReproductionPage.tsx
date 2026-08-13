import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  createBreedingCovering,
  deleteBreedingCovering,
  getAnimals,
  getBreedingCoverings,
  updateBreedingCovering,
  type Animal,
  type BreedingCovering,
  type BreedingCoveringInput,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import { ABCCMM_STATUS_LABELS, BREEDING_METHODS, breedingMethodLabel } from '../../constants/breedingMethods';
import { formatDateBR } from '../../utils/dateTime';

const emptyForm: BreedingCoveringInput = {
  mareAnimalId: '',
  stallionAnimalId: null,
  stallionName: '',
  method: 'ia',
  coveringDate: new Date().toISOString().slice(0, 10),
  season: '',
  veterinarian: '',
  abccmmStatus: 'pendente',
  notes: '',
};

export default function ReproductionPage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<BreedingCovering[]>([]);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<BreedingCovering | null>(null);
  const [form, setForm] = useState<BreedingCoveringInput>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, animalList] = await Promise.all([getBreedingCoverings(q || undefined), getAnimals()]);
      setItems(list);
      setAnimals(animalList.filter((a) => a.status === 'ativo'));
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar reprodução');
    } finally {
      setLoading(false);
    }
  }, [q, toastError]);

  useEffect(() => {
    const t = window.setTimeout(load, q ? 300 : 0);
    return () => window.clearTimeout(t);
  }, [load, q]);

  const mares = useMemo(() => animals.filter((a) => a.sex === 'F'), [animals]);
  const stallions = useMemo(() => animals.filter((a) => a.sex === 'M'), [animals]);

  const openNew = () => {
    setEditItem(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: BreedingCovering) => {
    setEditItem(item);
    setForm({
      mareAnimalId: item.mareAnimalId,
      stallionAnimalId: item.stallionAnimalId,
      stallionName: item.stallionName || '',
      method: item.method,
      coveringDate: item.coveringDate,
      season: item.season || '',
      veterinarian: item.veterinarian || '',
      abccmmStatus: item.abccmmStatus,
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.mareAnimalId || !form.coveringDate) {
      toastError('Égua e data são obrigatórias');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        stallionName: form.stallionName?.trim() || null,
        season: form.season?.trim() || null,
        veterinarian: form.veterinarian?.trim() || null,
        notes: form.notes?.trim() || null,
      };
      if (editItem) {
        await updateBreedingCovering(editItem.id, payload);
        success('Cobertura atualizada');
      } else {
        await createBreedingCovering(payload);
        success('Cobertura registrada');
      }
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: BreedingCovering) => {
    if (!canDelete || !window.confirm('Excluir esta cobertura?')) return;
    try {
      await deleteBreedingCovering(item.id);
      success('Cobertura excluída');
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao excluir');
    }
  };

  if (loading && items.length === 0) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Cobrições por temporada · status ABCCMM manual (integração API em fase futura).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar égua, garanhão, estação..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        {canCreate && (
          <AppButton onClick={openNew} className="inline-flex items-center gap-2">
            <Plus className="h-4 w-4" /> Nova cobertura
          </AppButton>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 font-medium">Égua</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Garanhão</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Método</th>
              <th className="px-4 py-3 font-medium">ABCCMM</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                  Nenhuma cobertura registrada
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-brand-beige/70">
                <td className="px-4 py-3">{formatDateBR(item.coveringDate)}</td>
                <td className="px-4 py-3 font-medium">{item.mareName}</td>
                <td className="hidden px-4 py-3 md:table-cell">{item.stallionName || '—'}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{breedingMethodLabel(item.method)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      item.abccmmStatus === 'pendente'
                        ? 'bg-amber-50 text-amber-800'
                        : item.abccmmStatus === 'comunicado'
                          ? 'bg-blue-50 text-blue-800'
                          : 'bg-emerald-50 text-emerald-800'
                    }`}
                  >
                    {ABCCMM_STATUS_LABELS[item.abccmmStatus]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      className="mr-2 text-xs font-medium text-brand-brown hover:underline"
                    >
                      Editar
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(item)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        title={editItem ? 'Editar cobertura' : 'Nova cobertura'}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Égua *</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.mareAnimalId}
              onChange={(e) => setForm({ ...form, mareAnimalId: e.target.value })}
            >
              <option value="">Selecione...</option>
              {mares.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Garanhão (plantel)</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.stallionAnimalId || ''}
              onChange={(e) =>
                setForm({ ...form, stallionAnimalId: e.target.value || null })
              }
            >
              <option value="">Externo / informar nome</option>
              {stallions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Nome garanhão (externo)</span>
            <input
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.stallionName || ''}
              onChange={(e) => setForm({ ...form, stallionName: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Método</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as BreedingCoveringInput['method'] })
              }
            >
              {BREEDING_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Data *</span>
            <input
              type="date"
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.coveringDate}
              onChange={(e) => setForm({ ...form, coveringDate: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Estação</span>
            <input
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              placeholder="Ex.: 2026/2027"
              value={form.season || ''}
              onChange={(e) => setForm({ ...form, season: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Veterinário</span>
            <input
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.veterinarian || ''}
              onChange={(e) => setForm({ ...form, veterinarian: e.target.value })}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Status ABCCMM</span>
            <select
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.abccmmStatus}
              onChange={(e) =>
                setForm({
                  ...form,
                  abccmmStatus: e.target.value as BreedingCoveringInput['abccmmStatus'],
                })
              }
            >
              {Object.entries(ABCCMM_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm sm:col-span-2">
            <span className="text-xs font-medium uppercase text-brand-olive">Observações</span>
            <textarea
              rows={2}
              className="w-full rounded-xl border border-brand-beige px-3 py-2"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
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
