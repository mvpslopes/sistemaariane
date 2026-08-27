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
import RowActions from '../../components/RowActions';
import {
  ABCCMM_STATUS_LABELS,
  BIRTH_STATUS_LABELS,
  BREEDING_METHODS,
  EMBRYO_TRANSFER_STATUS_LABELS,
  breedingMethodLabel,
} from '../../constants/breedingMethods';
import { formatDateBR, todayDateISO } from '../../utils/dateTime';
import { equineDueWindow, equineExpectedDue } from '../../utils/equineGestation';

type CoveringTab = 'cobricao' | 'embriao' | 'procedimentos' | 'exames' | 'parto';

const TABS: { id: CoveringTab; label: string }[] = [
  { id: 'cobricao', label: 'Dados da cobrição' },
  { id: 'embriao', label: 'Transferência de embrião' },
  { id: 'procedimentos', label: 'Procedimentos' },
  { id: 'exames', label: 'Exames laboratoriais' },
  { id: 'parto', label: 'Parto' },
];

const inputClass = 'w-full rounded-xl border border-brand-beige px-3 py-2 text-sm';

function asDateInput(value?: string | null) {
  return value ? String(value).slice(0, 10) : '';
}

function emptyForm(): BreedingCoveringInput {
  const coveringDate = todayDateISO();
  return {
    mareAnimalId: '',
    stallionAnimalId: null,
    stallionName: '',
    method: 'ia',
    coveringDate,
    season: '',
    veterinarian: '',
    abccmmStatus: 'pendente',
    associationProtocol: '',
    expectedDueDate: equineExpectedDue(coveringDate) || '',
    recipientAnimalId: null,
    embryoTransferDate: '',
    embryoTransferStatus: 'pendente',
    embryoTransferNotes: '',
    proceduresNotes: '',
    labExamsNotes: '',
    birthDate: '',
    birthStatus: 'previsto',
    birthNotes: '',
    notes: '',
  };
}

function itemToForm(item: BreedingCovering): BreedingCoveringInput {
  return {
    mareAnimalId: item.mareAnimalId,
    stallionAnimalId: item.stallionAnimalId,
    stallionName: item.stallionName || '',
    method: item.method,
    coveringDate: asDateInput(item.coveringDate),
    season: item.season || '',
    veterinarian: item.veterinarian || '',
    abccmmStatus: item.abccmmStatus,
    associationProtocol: item.associationProtocol || '',
    expectedDueDate: asDateInput(item.expectedDueDate) || equineExpectedDue(item.coveringDate) || '',
    recipientAnimalId: item.recipientAnimalId,
    embryoTransferDate: asDateInput(item.embryoTransferDate),
    embryoTransferStatus: item.embryoTransferStatus || 'pendente',
    embryoTransferNotes: item.embryoTransferNotes || '',
    proceduresNotes: item.proceduresNotes || '',
    labExamsNotes: item.labExamsNotes || '',
    birthDate: asDateInput(item.birthDate),
    birthStatus: item.birthStatus || 'previsto',
    birthNotes: item.birthNotes || '',
    notes: item.notes || '',
  };
}

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
  const [tab, setTab] = useState<CoveringTab>('cobricao');
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
  const recipientMares = useMemo(
    () => mares.filter((a) => a.id !== form.mareAnimalId),
    [mares, form.mareAnimalId]
  );

  const dueWindow = useMemo(
    () => equineDueWindow(form.coveringDate, form.expectedDueDate),
    [form.coveringDate, form.expectedDueDate]
  );

  const showProtocol = form.abccmmStatus === 'comunicado' || form.abccmmStatus === 'confirmado';

  const openNew = () => {
    setEditItem(null);
    setForm(emptyForm());
    setTab('cobricao');
    setModalOpen(true);
  };

  const openEdit = (item: BreedingCovering) => {
    setEditItem(item);
    setForm(itemToForm(item));
    setTab('cobricao');
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.mareAnimalId || !form.coveringDate) {
      toastError('Égua e data são obrigatórias');
      setTab('cobricao');
      return;
    }
    setSaving(true);
    try {
      const payload: BreedingCoveringInput = {
        ...form,
        stallionName: form.stallionName?.trim() || null,
        season: form.season?.trim() || null,
        veterinarian: form.veterinarian?.trim() || null,
        associationProtocol: form.associationProtocol?.trim() || null,
        expectedDueDate: form.expectedDueDate || equineExpectedDue(form.coveringDate),
        recipientAnimalId: form.recipientAnimalId || null,
        embryoTransferDate: form.embryoTransferDate || null,
        embryoTransferNotes: form.embryoTransferNotes?.trim() || null,
        proceduresNotes: form.proceduresNotes?.trim() || null,
        labExamsNotes: form.labExamsNotes?.trim() || null,
        birthDate: form.birthDate || null,
        birthNotes: form.birthNotes?.trim() || null,
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
        Cobrições por temporada · status ABCCMM manual (integração API em fase futura). A previsão de parto é
        calculada automaticamente (11 meses).
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-[12rem] flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
          <input
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
            placeholder="Buscar égua, garanhão, protocolo, estação..."
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
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Previsão de parto</th>
              <th className="px-4 py-3 font-medium">ABCCMM</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                  Nenhuma cobertura registrada
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-brand-beige/70">
                <td className="px-4 py-3">{formatDateBR(item.coveringDate)}</td>
                <td className="px-4 py-3 font-medium">
                  {item.mareName}
                  {item.recipientName && (
                    <span className="mt-0.5 block text-xs font-normal text-brand-olive">
                      Receptora: {item.recipientName}
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">{item.stallionName || '—'}</td>
                <td className="hidden px-4 py-3 sm:table-cell">{breedingMethodLabel(item.method)}</td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  {item.expectedDueStart && item.expectedDueEnd
                    ? `${formatDateBR(item.expectedDueStart)} a ${formatDateBR(item.expectedDueEnd)}`
                    : formatDateBR(item.expectedDueDate)}
                </td>
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
                  {item.associationProtocol && (
                    <span className="mt-0.5 block text-xs text-brand-olive">Nº {item.associationProtocol}</span>
                  )}
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

      <Modal
        open={modalOpen}
        title={editItem ? 'Editar cobertura' : 'Nova cobertura'}
        onClose={() => setModalOpen(false)}
        size="2xl"
      >
        <div className="sticky top-0 z-[1] -mx-4 mb-3 border-b border-brand-beige bg-white px-4 sm:-mx-5">
          <div className="flex gap-1 overflow-x-auto pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                  tab === t.id
                    ? 'bg-brand-brown text-white'
                    : 'bg-brand-off-white text-brand-olive hover:bg-brand-beige/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'cobricao' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Égua *</span>
              <select
                className={inputClass}
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
                className={inputClass}
                value={form.stallionAnimalId || ''}
                onChange={(e) => setForm({ ...form, stallionAnimalId: e.target.value || null })}
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
                className={inputClass}
                value={form.stallionName || ''}
                onChange={(e) => setForm({ ...form, stallionName: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Método</span>
              <select
                className={inputClass}
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
                className={inputClass}
                value={form.coveringDate}
                onChange={(e) => {
                  const coveringDate = e.target.value;
                  setForm({
                    ...form,
                    coveringDate,
                    expectedDueDate: equineExpectedDue(coveringDate) || '',
                  });
                }}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Estação</span>
              <input
                className={inputClass}
                placeholder="Ex.: 2026/2027"
                value={form.season || ''}
                onChange={(e) => setForm({ ...form, season: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Veterinário</span>
              <input
                className={inputClass}
                value={form.veterinarian || ''}
                onChange={(e) => setForm({ ...form, veterinarian: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Status ABCCMM</span>
              <select
                className={inputClass}
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
            {showProtocol && (
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">Protocolo da associação</span>
                <input
                  className={inputClass}
                  placeholder="Ex.: 879/2026"
                  value={form.associationProtocol || ''}
                  onChange={(e) => setForm({ ...form, associationProtocol: e.target.value })}
                />
                <span className="block text-[11px] text-brand-olive">
                  Número do comunicado à ABCCMM (Número CC).
                </span>
              </label>
            )}
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Observações</span>
              <textarea
                rows={2}
                className={inputClass}
                value={form.notes || ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
        )}

        {tab === 'embriao' && (
          <div className="grid gap-3 sm:grid-cols-2">
            {form.method !== 'te' && (
              <p className="rounded-xl border border-brand-beige bg-brand-off-white px-3 py-2 text-sm text-brand-olive sm:col-span-2">
                Esta aba é usada quando o método é transferência de embrião. Você pode preencher a receptora
                mesmo assim, se precisar.
              </p>
            )}
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Receptora</span>
              <select
                className={inputClass}
                value={form.recipientAnimalId || ''}
                onChange={(e) => setForm({ ...form, recipientAnimalId: e.target.value || null })}
              >
                <option value="">Selecione...</option>
                {recipientMares.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Data da transferência</span>
              <input
                type="date"
                className={inputClass}
                value={form.embryoTransferDate || ''}
                onChange={(e) => setForm({ ...form, embryoTransferDate: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Estado da transferência</span>
              <select
                className={inputClass}
                value={form.embryoTransferStatus || 'pendente'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    embryoTransferStatus: e.target.value as BreedingCoveringInput['embryoTransferStatus'],
                  })
                }
              >
                {Object.entries(EMBRYO_TRANSFER_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {dueWindow && (
              <p className="text-sm font-medium text-brand-dark-brown sm:col-span-2">
                Janela prevista de parto:{' '}
                <span className="text-brand-brown">
                  {formatDateBR(dueWindow.start)} a {formatDateBR(dueWindow.end)}
                </span>
              </p>
            )}
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Anotações</span>
              <textarea
                rows={3}
                className={inputClass}
                value={form.embryoTransferNotes || ''}
                onChange={(e) => setForm({ ...form, embryoTransferNotes: e.target.value })}
              />
            </label>
          </div>
        )}

        {tab === 'procedimentos' && (
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Procedimentos</span>
            <textarea
              rows={8}
              className={inputClass}
              placeholder="Registre procedimentos realizados nesta cobrição (folículo, lavagem, medicação, etc.)."
              value={form.proceduresNotes || ''}
              onChange={(e) => setForm({ ...form, proceduresNotes: e.target.value })}
            />
          </label>
        )}

        {tab === 'exames' && (
          <label className="block space-y-1 text-sm">
            <span className="text-xs font-medium uppercase text-brand-olive">Exames laboratoriais</span>
            <textarea
              rows={8}
              className={inputClass}
              placeholder="Resultados de exames (progesterona, ultrassom, cultura, etc.)."
              value={form.labExamsNotes || ''}
              onChange={(e) => setForm({ ...form, labExamsNotes: e.target.value })}
            />
          </label>
        )}

        {tab === 'parto' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl border border-brand-beige bg-brand-off-white px-3 py-2 text-sm text-brand-olive sm:col-span-2">
              A gestação da égua dura em média <strong className="text-brand-dark-brown">11 meses</strong> a
              partir da data da cobrição. A janela abaixo usa essa previsão com uma margem de segurança.
            </p>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Previsão de parto</span>
              <input
                type="date"
                className={inputClass}
                value={form.expectedDueDate || ''}
                onChange={(e) => setForm({ ...form, expectedDueDate: e.target.value })}
              />
            </label>
            <div className="flex flex-col justify-end space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Janela prevista</span>
              <p className="rounded-xl border border-brand-beige bg-white px-3 py-2 font-medium text-brand-dark-brown">
                {dueWindow
                  ? `${formatDateBR(dueWindow.start)} a ${formatDateBR(dueWindow.end)}`
                  : 'Informe a data da cobrição'}
              </p>
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Data do parto</span>
              <input
                type="date"
                className={inputClass}
                value={form.birthDate || ''}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs font-medium uppercase text-brand-olive">Resultado</span>
              <select
                className={inputClass}
                value={form.birthStatus || 'previsto'}
                onChange={(e) =>
                  setForm({
                    ...form,
                    birthStatus: e.target.value as BreedingCoveringInput['birthStatus'],
                  })
                }
              >
                {Object.entries(BIRTH_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm sm:col-span-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Observações do parto</span>
              <textarea
                rows={3}
                className={inputClass}
                value={form.birthNotes || ''}
                onChange={(e) => setForm({ ...form, birthNotes: e.target.value })}
              />
            </label>
          </div>
        )}

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
