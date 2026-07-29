import { useEffect, useState } from 'react';
import {
  deleteAnimal,
  createAnimal,
  getAnimal,
  getClients,
  mediaUrl,
  updateAnimal,
  uploadAnimalPhoto,
  type Client,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import { Camera, Trash2 } from 'lucide-react';

interface FormState {
  name: string;
  registration_no: string;
  chip_no: string;
  sex: '' | 'M' | 'F';
  breed: string;
  association: 'ABCCMM' | 'ABQM' | 'OUTRA' | 'NENHUMA';
  birth_date: string;
  color: string;
  resenha: string;
  status: 'ativo' | 'vendido' | 'falecido' | 'transferido';
  ownership_type: 'unico' | 'condominio';
  notes: string;
  photo_url: string;
  clientId: string;
  sharePct: number;
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
  clientId: '',
  sharePct: 100,
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
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<FormState>(empty);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      try {
        const clientList = await getClients();
        setClients(clientList.filter((c) => c.active));
        if (!isNew) {
          const animal = await getAnimal(animalId!);
          const primary = animal.owners?.[0];
          setForm({
            name: animal.name || '',
            registration_no: animal.registration_no || '',
            chip_no: animal.chip_no || '',
            sex: animal.sex || '',
            breed: animal.breed || '',
            association: animal.association || 'NENHUMA',
            birth_date: animal.birth_date || '',
            color: animal.color || '',
            resenha: animal.resenha || '',
            status: animal.status || 'ativo',
            ownership_type: animal.ownership_type || 'unico',
            notes: animal.notes || '',
            photo_url: animal.photo_url || '',
            clientId: primary?.clientId || '',
            sharePct: primary?.sharePct ?? 100,
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
    ownership_type: form.ownership_type,
    notes: form.notes || null,
    photo_url: form.photo_url || null,
    owners: form.clientId
      ? [{ clientId: form.clientId, sharePct: form.sharePct, isPrimary: true }]
      : [],
    genealogy: {
      sireName: form.sireName || null,
      damName: form.damName || null,
    },
  });

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !canWrite) return;
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
    if (!canWrite) return;
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
    if (!canWrite || isNew) return;
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
          {canWrite && (
            <div className="flex flex-col gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive">
                {uploading ? 'Enviando...' : 'Escolher foto'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  disabled={uploading}
                  onChange={onPhotoChange}
                />
              </label>
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
          <input required disabled={!canWrite} value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Nº registro">
          <input disabled={!canWrite} value={form.registration_no} onChange={(e) => set('registration_no', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Chip">
          <input disabled={!canWrite} value={form.chip_no} onChange={(e) => set('chip_no', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Sexo">
          <select disabled={!canWrite} value={form.sex} onChange={(e) => set('sex', e.target.value as FormState['sex'])} className={inputClass}>
            <option value="">—</option>
            <option value="M">Macho</option>
            <option value="F">Fêmea</option>
          </select>
        </Field>
        <Field label="Raça / linhagem">
          <input disabled={!canWrite} value={form.breed} onChange={(e) => set('breed', e.target.value)} className={inputClass} placeholder="Mangalarga, QM..." />
        </Field>
        <Field label="Associação">
          <select disabled={!canWrite} value={form.association} onChange={(e) => set('association', e.target.value as FormState['association'])} className={inputClass}>
            <option value="NENHUMA">Nenhuma</option>
            <option value="ABCCMM">ABCCMM</option>
            <option value="ABQM">ABQM</option>
            <option value="OUTRA">Outra</option>
          </select>
        </Field>
        <Field label="Nascimento">
          <input type="date" disabled={!canWrite} value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Pelagem / cor">
          <input disabled={!canWrite} value={form.color} onChange={(e) => set('color', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Status">
          <select disabled={!canWrite} value={form.status} onChange={(e) => set('status', e.target.value as FormState['status'])} className={inputClass}>
            <option value="ativo">Ativo</option>
            <option value="vendido">Vendido</option>
            <option value="falecido">Falecido</option>
            <option value="transferido">Transferido</option>
          </select>
        </Field>
        <Field label="Propriedade">
          <select disabled={!canWrite} value={form.ownership_type} onChange={(e) => set('ownership_type', e.target.value as FormState['ownership_type'])} className={inputClass}>
            <option value="unico">Único</option>
            <option value="condominio">Condomínio</option>
          </select>
        </Field>
        <Field label="Proprietário principal" className="sm:col-span-2">
          <select disabled={!canWrite} value={form.clientId} onChange={(e) => set('clientId', e.target.value)} className={inputClass}>
            <option value="">— Selecionar cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Nome do pai">
          <input disabled={!canWrite} value={form.sireName} onChange={(e) => set('sireName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Nome da mãe">
          <input disabled={!canWrite} value={form.damName} onChange={(e) => set('damName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Resenha" className="sm:col-span-2">
          <textarea disabled={!canWrite} rows={3} value={form.resenha} onChange={(e) => set('resenha', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea disabled={!canWrite} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
        {canWrite && (
          <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
        {!isNew && canWrite && (
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
