import { useEffect, useState } from 'react';
import {
  createClient,
  getClient,
  updateClient,
  deleteClient,
  type Client,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';

type PartyRole = 'buyer' | 'seller' | 'assessor' | 'witness';

function emptyForm(defaultPartyRole?: PartyRole): Partial<Client> {
  return {
    name: '',
    document_type: 'CPF',
    document: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    state: '',
    address: '',
    notes: '',
    active: true,
    is_seller: defaultPartyRole === 'seller',
    is_buyer: defaultPartyRole === 'buyer' || !defaultPartyRole,
    is_assessor: defaultPartyRole === 'assessor',
    is_witness: defaultPartyRole === 'witness',
  };
}

interface ClientFormProps {
  clientId: string | null;
  defaultPartyRole?: PartyRole;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClientForm({ clientId, defaultPartyRole, onClose, onSaved }: ClientFormProps) {
  const isNew = !clientId;
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Client>>(() => emptyForm(defaultPartyRole));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) {
      setForm(emptyForm(defaultPartyRole));
      setLoading(false);
      return;
    }
    setLoading(true);
    getClient(clientId!)
      .then(setForm)
      .catch((e) => toastError(e.message || 'Erro ao carregar cliente'))
      .finally(() => setLoading(false));
  }, [clientId, isNew, toastError]);

  const set = (key: keyof Client, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      if (isNew) {
        await createClient(form);
        success('Pessoa cadastrada com sucesso');
      } else {
        await updateClient(clientId!, form);
        success('Pessoa atualizada com sucesso');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!canWrite || isNew) return;
    if (
      !confirm(
        'Excluir este cliente definitivamente?\n\nEle será removido dos proprietários dos animais vinculados. Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    try {
      await deleteClient(clientId!);
      success('Pessoa excluída');
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao excluir cliente');
    }
  };

  if (loading) return <Loading message="Carregando cliente..." />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome *" className="sm:col-span-2">
          <input required disabled={!canWrite} value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Tipo documento">
          <select disabled={!canWrite} value={form.document_type || 'CPF'} onChange={(e) => set('document_type', e.target.value)} className={inputClass}>
            <option value="CPF">CPF</option>
            <option value="CNPJ">CNPJ</option>
          </select>
        </Field>
        <Field label="Documento">
          <input disabled={!canWrite} value={form.document || ''} onChange={(e) => set('document', e.target.value)} className={inputClass} />
        </Field>
        <Field label="E-mail">
          <input type="email" disabled={!canWrite} value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Telefone">
          <input disabled={!canWrite} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
        </Field>
        <Field label="WhatsApp">
          <input disabled={!canWrite} value={form.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Cidade">
          <input disabled={!canWrite} value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputClass} />
        </Field>
        <Field label="UF">
          <input disabled={!canWrite} maxLength={2} value={form.state || ''} onChange={(e) => set('state', e.target.value.toUpperCase())} className={inputClass} />
        </Field>
        <Field label="Endereço" className="sm:col-span-2">
          <input disabled={!canWrite} value={form.address || ''} onChange={(e) => set('address', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <textarea disabled={!canWrite} rows={3} value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
        </Field>
        {canWrite && (
          <div className="space-y-2 sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
              Papéis (pode marcar mais de um)
            </span>
            <div className="flex flex-wrap gap-4 text-sm text-brand-dark-brown/80">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.is_buyer} onChange={(e) => set('is_buyer', e.target.checked)} />
                Comprador
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.is_seller} onChange={(e) => set('is_seller', e.target.checked)} />
                Vendedor
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.is_assessor} onChange={(e) => set('is_assessor', e.target.checked)} />
                Assessor
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={!!form.is_witness} onChange={(e) => set('is_witness', e.target.checked)} />
                Testemunha
              </label>
            </div>
          </div>
        )}
        {!isNew && canWrite && (
          <label className="flex items-center gap-2 text-sm text-brand-dark-brown/80 sm:col-span-2">
            <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} />
            Pessoa ativa
          </label>
        )}
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
