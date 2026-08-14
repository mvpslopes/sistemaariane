import { useEffect, useState } from 'react';
import {
  deleteAnimal,
  createAnimal,
  createCatalogItem,
  getAnimal,
  getCatalogs,
  getClients,
  mediaUrl,
  updateAnimal,
  uploadAnimalPhoto,
  type CatalogItem,
  type Client,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import { Camera, Plus, Trash2 } from 'lucide-react';
import PhotoPicker from '../../components/PhotoPicker';

interface OwnerRow {
  clientId: string;
  sharePct: number;
  isPrimary: boolean;
}

interface FormState {
  name: string;
  registration_no: string;
  chip_no: string;
  sex: '' | 'M' | 'F' | 'C';
  breed: string;
  association: 'ABCCMM' | 'ABQM' | 'OUTRA' | 'NENHUMA';
  birth_date: string;
  color: string;
  resenha: string;
  status: 'ativo' | 'vendido' | 'falecido' | 'transferido';
  ownership_type: 'unico' | 'condominio';
  notes: string;
  photo_url: string;
  owners: OwnerRow[];
  sireName: string;
  damName: string;
}

const empty: FormState = {
  name: '',
  registration_no: '',
  chip_no: '',
  sex: '',
  breed: '',
  association: 'NENHUMA',
  birth_date: '',
  color: '',
  resenha: '',
  status: 'ativo',
  ownership_type: 'unico',
  notes: '',
  photo_url: '',
  owners: [],
  sireName: '',
  damName: '',
};

interface AnimalFormProps {
  animalId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function AnimalForm({ animalId, onClose, onSaved }: AnimalFormProps) {
  const isNew = !animalId;
  const { canCreate, canUpdate, canDelete } = useAuth();
  const canEdit = isNew ? canCreate : canUpdate;
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [clients, setClients] = useState<Client[]>([]);
  const [breeds, setBreeds] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addingBreed, setAddingBreed] = useState(false);
  const [newBreed, setNewBreed] = useState('');

  const loadBreeds = async () => {
    try {
      setBreeds(await getCatalogs('breed'));
    } catch {
      /* catálogo opcional se migration ainda não rodou */
    }
  };

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      try {
        const [clientList] = await Promise.all([getClients(), loadBreeds()]);
        setClients(clientList.filter((c) => c.active));
        if (!isNew) {
          const animal = await getAnimal(animalId!);
          const owners =
            animal.owners?.length
              ? animal.owners.map((o, i) => ({
                  clientId: o.clientId,
                  sharePct: o.sharePct ?? (animal.ownership_type === 'unico' ? 100 : 0),
                  isPrimary: o.isPrimary ?? i === 0,
                }))
              : [];
          setForm({
            name: animal.name || '',
            registration_no: animal.registration_no || '',
            chip_no: animal.chip_no || '',
            sex: (animal.sex as FormState['sex']) || '',
            breed: animal.breed || '',
            association: animal.association || 'NENHUMA',
            birth_date: animal.birth_date || '',
            color: animal.color || '',
            resenha: animal.resenha || '',
            status: animal.status || 'ativo',
            ownership_type: animal.ownership_type || (owners.length > 1 ? 'condominio' : 'unico'),
            notes: animal.notes || '',
            photo_url: animal.photo_url || '',
            owners,
            sireName: animal.genealogy?.sireName || '',
            damName: animal.genealogy?.damName || '',
          });
        } else {
          setForm(empty);
        }
      } catch (e: any) {
        toastError(e.message || 'Erro ao carregar animal');
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [animalId, isNew, toastError]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setOwnershipType = (ownership_type: FormState['ownership_type']) => {
    setForm((prev) => {
      if (ownership_type === 'unico') {
        if (!prev.owners.length) return { ...prev, ownership_type, owners: [] };
        const first = prev.owners[0];
        return {
          ...prev,
          ownership_type,
          owners: [{ ...first, sharePct: 100, isPrimary: true }],
        };
      }
      return {
        ...prev,
        ownership_type,
        owners: prev.owners.length
          ? prev.owners.map((o, i) => ({ ...o, isPrimary: i === 0 ? true : o.isPrimary }))
          : [],
      };
    });
  };

  const updateOwner = (index: number, patch: Partial<OwnerRow>) => {
    setForm((prev) => {
      const owners = prev.owners.map((o, i) => (i === index ? { ...o, ...patch } : o));
      if (patch.isPrimary) {
        owners.forEach((o, i) => {
          o.isPrimary = i === index;
        });
      }
      return { ...prev, owners };
    });
  };

  const addOwner = () => {
    setForm((prev) => {
      const owners = [
        ...prev.owners,
        { clientId: '', sharePct: 0, isPrimary: prev.owners.length === 0 },
      ];
      return {
        ...prev,
        ownership_type: owners.length > 1 ? 'condominio' : prev.ownership_type,
        owners,
      };
    });
  };

  const removeOwner = (index: number) => {
    setForm((prev) => {
      let owners = prev.owners.filter((_, i) => i !== index);
      if (owners.length && !owners.some((o) => o.isPrimary)) owners[0].isPrimary = true;
      return {
        ...prev,
        ownership_type: owners.length > 1 ? 'condominio' : 'unico',
        owners: owners.length === 1 ? [{ ...owners[0], sharePct: 100, isPrimary: true }] : owners,
      };
    });
  };

  const payload = () => ({
    name: form.name,
    registration_no: form.registration_no || null,
    chip_no: form.chip_no || null,
    sex: form.sex || null,
    breed: form.breed || null,
    association: form.association,
    birth_date: form.birth_date || null,
    color: form.color || null,
    resenha: form.resenha || null,
    status: form.status,
    ownership_type: form.owners.filter((o) => o.clientId).length > 1 ? 'condominio' : form.ownership_type,
    notes: form.notes || null,
    photo_url: form.photo_url || null,
    owners: form.owners
      .filter((o) => o.clientId)
      .map((o, i) => ({
        clientId: o.clientId,
        sharePct: form.ownership_type === 'unico' || form.owners.filter((x) => x.clientId).length === 1
          ? 100
          : o.sharePct,
        isPrimary: o.isPrimary || i === 0,
      })),
    genealogy: {
      sireName: form.sireName || null,
      damName: form.damName || null,
    },
  });

  const onPhotoChange = async (file: File | null) => {
    if (!file || !canEdit) return;
    if (!file.type.startsWith('image/')) {
      toastError('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toastError('Imagem muito grande (máx. 5 MB)');
      return;
    }
    setUploading(true);
    try {
      const res = await uploadAnimalPhoto(file);
      set('photo_url', res.url);
      success('Foto enviada');
    } catch (err: any) {
      toastError(err.message || 'Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const filled = form.owners.filter((o) => o.clientId);
    if (filled.length) {
      const ids = filled.map((o) => o.clientId);
      if (new Set(ids).size !== ids.length) {
        toastError('Não repita o mesmo vendedor');
        return;
      }
      if (filled.length > 1) {
        const total = filled.reduce((s, o) => s + Number(o.sharePct || 0), 0);
        if (Math.abs(total - 100) > 0.05) {
          toastError(`A soma das cotas deve ser 100% (atual: ${total.toFixed(2)}%)`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      if (isNew) {
        await createAnimal(payload());
        success('Animal cadastrado com sucesso');
      } else {
        await updateAnimal(animalId!, payload());
        success('Animal atualizado com sucesso');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar animal');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!canEdit || isNew) return;
    if (
      !confirm(
        'Excluir este animal definitivamente?\n\nA ficha, vínculos de proprietários e a foto serão removidos. Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    try {
      await deleteAnimal(animalId!);
      success('Animal excluído');
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao excluir animal');
    }
  };

  if (loading) return <Loading message="Carregando animal..." />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Foto do animal" className="sm:col-span-2">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-xl border border-brand-beige bg-brand-off-white">
            {form.photo_url ? (
              <img
                src={mediaUrl(form.photo_url) || undefined}
                alt="Foto do animal"
                className="h-full w-full object-cover"
              />
            ) : (
              <Camera className="h-8 w-8 text-brand-olive/50" />
            )}
          </div>
          {canEdit && (
            <div className="flex flex-col gap-2">
              <PhotoPicker
                onFile={onPhotoChange}
                disabled={uploading}
                cameraLabel={uploading ? 'Enviando…' : 'Tirar foto'}
                galleryLabel="Galeria"
                fileLabel={uploading ? 'Enviando…' : 'Escolher foto'}
              />
              {form.photo_url && (
                <button
                  type="button"
                  onClick={() => set('photo_url', '')}
                  className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              )}
              <p className="text-xs text-brand-olive">JPG, PNG, WEBP ou GIF · máx. 5 MB</p>
            </div>
          )}
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" className="sm:col-span-2">
          <input required disabled={!canEdit} value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Nº registro">
          <input disabled={!canEdit} value={form.registration_no} onChange={(e) => set('registration_no', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Chip">
          <input disabled={!canEdit} value={form.chip_no} onChange={(e) => set('chip_no', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sexo">
          <select disabled={!canEdit} value={form.sex} onChange={(e) => set('sex', e.target.value as FormState['sex'])} className={inputClass}>
            <option value="">—</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
            <option value="C">Castrado</option>
          </select>
        </Field>
        <div className="space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Raça / linhagem</span>
          <div className="flex gap-2">
            <select
              disabled={!canEdit}
              value={form.breed}
              onChange={(e) => set('breed', e.target.value)}
              className={inputClass}
            >
              <option value="">— Selecionar ou cadastrar —</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
              {form.breed && !breeds.some((b) => b.name === form.breed) && (
                <option value={form.breed}>{form.breed}</option>
              )}
            </select>
            {canEdit && (
              <button
                type="button"
                title="Cadastrar raça"
                onClick={() => setAddingBreed((v) => !v)}
                className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown hover:bg-brand-beige/40"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          {addingBreed && canEdit && (
            <div className="flex gap-2 pt-1">
              <input
                value={newBreed}
                onChange={(e) => setNewBreed(e.target.value)}
                placeholder="Nova raça"
                className={inputClass}
              />
              <button
                type="button"
                className="shrink-0 rounded-xl bg-brand-brown px-3 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  const name = newBreed.trim();
                  if (!name) return toastError('Informe o nome da raça');
                  try {
                    await createCatalogItem({ kind: 'breed', name });
                    success('Raça cadastrada');
                    setNewBreed('');
                    setAddingBreed(false);
                    await loadBreeds();
                    set('breed', name);
                  } catch (err: any) {
                    toastError(err.message || 'Erro ao cadastrar raça');
                  }
                }}
              >
                Salvar
              </button>
            </div>
          )}
        </div>
        <Field label="Associação">
          <select disabled={!canEdit} value={form.association} onChange={(e) => set('association', e.target.value as FormState['association'])} className={inputClass}>
            <option value="NENHUMA">Nenhuma</option>
            <option value="ABCCMM">ABCCMM</option>
            <option value="ABQM">ABQM</option>
            <option value="OUTRA">Outra</option>
          </select>
        </Field>
        <Field label="Nascimento">
          <input type="date" disabled={!canEdit} value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Pelagem / cor">
          <input disabled={!canEdit} value={form.color} onChange={(e) => set('color', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Status">
          <select disabled={!canEdit} value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])} className={inputClass}>
            <option value="ativo">Ativo</option>
            <option value="vendido">Vendido</option>
            <option value="falecido">Falecido</option>
            <option value="transferido">Transferido</option>
          </select>
        </Field>
        <Field label="Propriedade">
          <select
            disabled={!canEdit}
            value={form.ownership_type}
            onChange={(e) => setOwnershipType(e.target.value as FormState['ownership_type'])}
            className={inputClass}
          >
            <option value="unico">Único</option>
            <option value="condominio">Condomínio (vários vendedores)</option>
          </select>
        </Field>
        <div className="sm:col-span-2 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
                Vendedor(es) / proprietário(s)
              </span>
              <p className="mt-0.5 text-[11px] text-brand-olive/80">
                Opcional no plantel. O vendedor será exigido ao cadastrar o lote no leilão.
              </p>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={addOwner}
                className="inline-flex items-center gap-1 rounded-lg border border-brand-beige bg-white px-2.5 py-1 text-xs font-medium text-brand-brown hover:bg-brand-beige/40"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar vendedor
              </button>
            )}
          </div>
          <div className="space-y-2 rounded-xl border border-brand-beige bg-brand-off-white/40 p-3">
            {!form.owners.length && (
              <p className="py-1 text-center text-xs text-brand-olive">Nenhum vendedor vinculado</p>
            )}
            {form.owners.map((owner, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_100px_auto_auto] sm:items-end">
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase text-brand-olive">Pessoa</span>
                  <select
                    disabled={!canEdit}
                    value={owner.clientId}
                    onChange={(e) => updateOwner(index, { clientId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Selecionar —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] uppercase text-brand-olive">Cota %</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={!canEdit || form.ownership_type === 'unico' || form.owners.length === 1}
                    value={owner.sharePct}
                    onChange={(e) => updateOwner(index, { sharePct: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
                <label className="flex items-center gap-2 pb-2.5 text-xs text-brand-dark-brown">
                  <input
                    type="radio"
                    name="primary-owner"
                    disabled={!canEdit}
                    checked={owner.isPrimary}
                    onChange={() => updateOwner(index, { isPrimary: true })}
                  />
                  Principal
                </label>
                {canEdit && form.owners.length > 1 && (
                  <button
                    type="button"
                    title="Remover"
                    onClick={() => removeOwner(index)}
                    className="mb-0.5 inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            {form.owners.length > 1 && (
              <p className="text-xs text-brand-olive">
                Soma das cotas:{' '}
                {form.owners.reduce((s, o) => s + Number(o.sharePct || 0), 0).toFixed(2)}% (deve totalizar 100%)
              </p>
            )}
          </div>
        </div>
        <Field label="Nome do pai">
          <input disabled={!canEdit} value={form.sireName} onChange={(e) => set('sireName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Nome da mãe">
          <input disabled={!canEdit} value={form.damName} onChange={(e) => set('damName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Resenha" className="sm:col-span-2">
          <textarea disabled={!canEdit} rows={3} value={form.resenha} onChange={(e) => set('resenha', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea disabled={!canEdit} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
        {canEdit && (
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
        {!isNew && canDelete && (
          <button type="button" onClick={onDelete} className="rounded-xl border border-red-200 px-5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
            Excluir
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm text-brand-dark-brown hover:bg-brand-off-white">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1.5 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige disabled:bg-brand-off-white';
