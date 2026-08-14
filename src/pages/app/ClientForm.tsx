import { useEffect, useState } from 'react';
import {
  createClient,
  createClientAccessUser,
  createClientBankAccount,
  createClientContact,
  createClientDocument,
  createClientProperty,
  deleteClient,
  deleteClientBankAccount,
  deleteClientContact,
  deleteClientDocument,
  deleteClientProperty,
  getClient,
  getClientAccessUser,
  getClientBankAccounts,
  getClientContacts,
  getClientDocuments,
  getClientProperties,
  mediaUrl,
  resetClientAccessPassword,
  updateClient,
  uploadPersonDocument,
  type AuthUser,
  type Client,
  type ClientBankAccount,
  type ClientContact,
  type ClientDocument,
  type ClientProperty,
  type PersonDocType,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PhotoPicker from '../../components/PhotoPicker';
import { formatCepInput, lookupCep } from '../../services/cepService';

type PartyRole = 'buyer' | 'seller' | 'assessor' | 'witness' | 'avalista';
type TabId = 'dados' | 'documentos' | 'propriedades' | 'contas' | 'contatos' | 'observacoes';

const TABS: { id: TabId; label: string }[] = [
  { id: 'dados', label: 'Dados' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'propriedades', label: 'Propriedades' },
  { id: 'contas', label: 'Contas' },
  { id: 'contatos', label: 'Contatos' },
  { id: 'observacoes', label: 'Observações' },
];

const DOC_LABELS: Record<PersonDocType, string> = {
  rg: 'RG',
  identidade: 'Identidade',
  cnh: 'CNH',
  comprovante_residencia: 'Comprovante de residência',
  selfie: 'Selfie',
  outro: 'Outro',
};

/** Campos mínimos para finalizar o cadastro de pessoa. */
function validateRequiredPerson(form: Partial<Client>): string | null {
  const missing: string[] = [];
  if (!form.name?.trim()) missing.push('Nome completo');

  const digits = (form.document || '').replace(/\D/g, '');
  if (!digits) {
    missing.push('CPF/CNPJ');
  } else if ((form.document_type || 'CPF') === 'CNPJ' ? digits.length !== 14 : digits.length !== 11) {
    return (form.document_type || 'CPF') === 'CNPJ'
      ? 'CNPJ inválido — informe 14 dígitos'
      : 'CPF inválido — informe 11 dígitos';
  }

  if (!form.email?.trim()) {
    missing.push('E-mail');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return 'E-mail inválido';
  }

  if (!form.phone?.trim()) missing.push('Telefone');

  if (!form.birth_date?.trim()) {
    missing.push('Data de nascimento');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(form.birth_date.trim())) {
    return 'Data de nascimento inválida';
  }

  const cep = (form.zip_code || '').replace(/\D/g, '');
  if (cep.length !== 8) missing.push('CEP');
  if (!form.address?.trim()) missing.push('Endereço (logradouro)');
  if (!form.city?.trim()) missing.push('Cidade');
  if (!(form.state || '').trim()) missing.push('UF');

  if (missing.length) {
    return `Preencha os campos obrigatórios: ${missing.join(', ')}`;
  }
  return null;
}

function emptyForm(defaultPartyRole?: PartyRole): Partial<Client> {
  return {
    name: '',
    document_type: 'CPF',
    document: '',
    rg: '',
    rg_issuer: '',
    birth_date: '',
    nickname: '',
    marital_status: '',
    profession: '',
    mother_name: '',
    father_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    state: '',
    address: '',
    address_number: '',
    zip_code: '',
    country: 'Brasil',
    notes: '',
    relationship_notes: '',
    problems_notes: '',
    active: true,
    is_seller: defaultPartyRole === 'seller',
    is_buyer: defaultPartyRole === 'buyer' || !defaultPartyRole,
    is_assessor: defaultPartyRole === 'assessor',
    is_witness: defaultPartyRole === 'witness',
    is_avalista: defaultPartyRole === 'avalista',
  };
}

interface ClientFormProps {
  clientId: string | null;
  defaultPartyRole?: PartyRole;
  onClose: () => void;
  onSaved: () => void;
}

export default function ClientForm({ clientId, defaultPartyRole, onClose, onSaved }: ClientFormProps) {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const [currentId, setCurrentId] = useState<string | null>(clientId);
  const isNew = !currentId;
  const canEdit = isNew ? canCreate : canUpdate;
  const [tab, setTab] = useState<TabId>('dados');
  const [form, setForm] = useState<Partial<Client>>(() => emptyForm(defaultPartyRole));
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [props, setProps] = useState<ClientProperty[]>([]);
  const [banks, setBanks] = useState<ClientBankAccount[]>([]);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [nestedLoading, setNestedLoading] = useState(false);

  const [docType, setDocType] = useState<PersonDocType>('rg');
  const [uploading, setUploading] = useState(false);

  const [propForm, setPropForm] = useState({
    name: '', cnpj: '', state_registration: '', zip_code: '', state: '', city: '', address: '',
    phone: '', property_type: 'Haras', is_primary: false, manager_name: '', manager_phone: '', manager_email: '', notes: '',
  });
  const [bankForm, setBankForm] = useState({
    account_type: 'corrente' as ClientBankAccount['account_type'],
    bank_name: '', agency: '', account_number: '', holder_name: '', holder_document: '', is_primary: true, notes: '',
  });
  const [contactForm, setContactForm] = useState({
    name: '', role_label: '', phone: '', email: '', notes: '',
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [propCepLoading, setPropCepLoading] = useState(false);
  const [accessUser, setAccessUser] = useState<AuthUser | null>(null);
  const [loadingAccessUser, setLoadingAccessUser] = useState(false);
  const [creatingAccessUser, setCreatingAccessUser] = useState(false);
  const [newAccessPassword, setNewAccessPassword] = useState('');
  const [confirmAccessPassword, setConfirmAccessPassword] = useState('');
  const [savingAccessPassword, setSavingAccessPassword] = useState(false);

  const applyPersonCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8 || !canEdit) return;
    setCepLoading(true);
    try {
      const data = await lookupCep(digits);
      if (!data) return;
      setForm((f) => ({
        ...f,
        zip_code: data.zip_code,
        address: data.address || f.address,
        city: data.city || f.city,
        state: data.state || f.state,
        country: f.country || 'Brasil',
      }));
    } catch (e: any) {
      toastError(e.message || 'Não foi possível buscar o CEP');
    } finally {
      setCepLoading(false);
    }
  };

  const applyPropCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length !== 8 || !canEdit) return;
    setPropCepLoading(true);
    try {
      const data = await lookupCep(digits);
      if (!data) return;
      setPropForm((f) => ({
        ...f,
        zip_code: data.zip_code,
        address: data.address || f.address,
        city: data.city || f.city,
        state: data.state || f.state,
      }));
    } catch (e: any) {
      toastError(e.message || 'Não foi possível buscar o CEP');
    } finally {
      setPropCepLoading(false);
    }
  };

  const loadAccessUser = async (id: string) => {
    setLoadingAccessUser(true);
    try {
      const res = await getClientAccessUser(id);
      setAccessUser(res.user);
    } catch {
      setAccessUser(null);
    } finally {
      setLoadingAccessUser(false);
    }
  };

  const onCreateAccessUser = async () => {
    if (!currentId || !canEdit) return;
    if (
      !confirm(
        'Criar usuário de acesso para esta pessoa?\n\nLogin: primeiro nome + sobrenome\nSenha inicial: ariane2026\n\nA pessoa verá contratos e dados conforme os papéis marcados (comprador, vendedor, assessor, testemunha).'
      )
    ) {
      return;
    }
    setCreatingAccessUser(true);
    try {
      const res = await createClientAccessUser(currentId);
      setAccessUser(res.user);
      success(`Usuário ${res.user.username} criado · senha: ${res.defaultPassword}`);
    } catch (e: any) {
      toastError(e.message || 'Erro ao criar usuário de acesso');
    } finally {
      setCreatingAccessUser(false);
    }
  };

  const onResetAccessPassword = async () => {
    if (!currentId || !canEdit || !accessUser) return;
    if (newAccessPassword.length < 6) {
      toastError('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newAccessPassword !== confirmAccessPassword) {
      toastError('A confirmação não confere com a nova senha');
      return;
    }
    setSavingAccessPassword(true);
    try {
      const res = await resetClientAccessPassword(currentId, newAccessPassword);
      success(res.message || 'Senha atualizada');
      setNewAccessPassword('');
      setConfirmAccessPassword('');
    } catch (e: any) {
      toastError(e.message || 'Erro ao alterar senha');
    } finally {
      setSavingAccessPassword(false);
    }
  };

  const partyRoleLabels = [
    form.is_buyer && 'Comprador',
    form.is_seller && 'Vendedor',
    form.is_assessor && 'Assessor',
    form.is_witness && 'Testemunha',
    form.is_avalista && 'Avalista',
  ].filter(Boolean) as string[];

  useEffect(() => {
    setCurrentId(clientId);
  }, [clientId]);

  useEffect(() => {
    if (!currentId) {
      setAccessUser(null);
      return;
    }
    loadAccessUser(currentId);
  }, [currentId]);

  useEffect(() => {
    if (!currentId) {
      setForm(emptyForm(defaultPartyRole));
      setLoading(false);
      setDocs([]);
      setProps([]);
      setBanks([]);
      setContacts([]);
      return;
    }
    setLoading(true);
    getClient(currentId)
      .then(setForm)
      .catch((e) => toastError(e.message || 'Erro ao carregar cliente'))
      .finally(() => setLoading(false));
  }, [currentId, defaultPartyRole, toastError]);

  const loadNested = async (id: string) => {
    setNestedLoading(true);
    try {
      const [d, p, b, c] = await Promise.all([
        getClientDocuments(id),
        getClientProperties(id),
        getClientBankAccounts(id),
        getClientContacts(id),
      ]);
      setDocs(d);
      setProps(p);
      setBanks(b);
      setContacts(c);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar detalhes');
    } finally {
      setNestedLoading(false);
    }
  };

  useEffect(() => {
    if (currentId && tab !== 'dados' && tab !== 'observacoes') {
      loadNested(currentId);
    }
  }, [currentId, tab]);

  const set = (key: keyof Client, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmitDados = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canEdit) return;
    const validationError = validateRequiredPerson(form);
    if (validationError) {
      toastError(validationError);
      setTab('dados');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const res = await createClient(form);
        success('Pessoa cadastrada — agora você pode anexar documentos e demais dados');
        setCurrentId(res.id);
        onSaved();
      } else {
        await updateClient(currentId!, form);
        success('Dados atualizados');
        onSaved();
      }
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar cliente');
    } finally {
      setSaving(false);
    }
  };

  const onSaveObservacoes = async () => {
    if (!canEdit || !currentId) return;
    const validationError = validateRequiredPerson(form);
    if (validationError) {
      toastError(validationError);
      setTab('dados');
      return;
    }
    setSaving(true);
    try {
      await updateClient(currentId, form);
      success('Observações salvas');
      onSaved();
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!canEdit || !currentId) return;
    if (
      !confirm(
        'Excluir este cliente definitivamente?\n\nEle será removido dos proprietários dos animais vinculados. Esta ação não pode ser desfeita.'
      )
    ) {
      return;
    }
    try {
      await deleteClient(currentId);
      success('Pessoa excluída');
      onSaved();
      onClose();
    } catch (err: any) {
      toastError(err.message || 'Erro ao excluir cliente');
    }
  };

  const onUploadDoc = async (file: File | null) => {
    if (!file || !currentId || !canEdit) return;
    setUploading(true);
    try {
      const up = await uploadPersonDocument(file);
      await createClientDocument(currentId, {
        docType,
        fileUrl: up.url,
        fileName: up.fileName || file.name,
      });
      success('Documento anexado');
      await loadNested(currentId);
    } catch (e: any) {
      toastError(e.message || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  };

  const selectTab = (id: TabId) => {
    setTab(id);
  };

  if (loading) return <Loading message="Carregando cliente..." />;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b border-brand-beige pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => selectTab(t.id)}
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

      {tab === 'dados' && (
        <form onSubmit={onSubmitDados} className="space-y-4">
          <p className="rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm text-brand-olive">
            <span className="font-semibold text-brand-dark-brown">Campos obrigatórios:</span>{' '}
            nome completo, CPF/CNPJ, e-mail, telefone, CEP e endereço (logradouro, cidade e UF).
          </p>
          <Section title="Identificação">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome completo *" className="sm:col-span-2">
                <input required disabled={!canEdit} value={form.name || ''} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="Nome completo" />
              </Field>
              <Field label="Apelido">
                <input disabled={!canEdit} value={form.nickname || ''} onChange={(e) => set('nickname', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Data de nascimento *">
                <input type="date" required disabled={!canEdit} value={form.birth_date || ''} onChange={(e) => set('birth_date', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Tipo documento *">
                <select required disabled={!canEdit} value={form.document_type || 'CPF'} onChange={(e) => set('document_type', e.target.value)} className={inputClass}>
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                </select>
              </Field>
              <Field label="CPF / CNPJ *">
                <input required disabled={!canEdit} value={form.document || ''} onChange={(e) => set('document', e.target.value)} className={inputClass} placeholder={form.document_type === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'} />
              </Field>
              <Field label="RG">
                <input disabled={!canEdit} value={form.rg || ''} onChange={(e) => set('rg', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Órgão emissor">
                <input disabled={!canEdit} placeholder="SSP/MG" value={form.rg_issuer || ''} onChange={(e) => set('rg_issuer', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Estado civil">
                <select disabled={!canEdit} value={form.marital_status || ''} onChange={(e) => set('marital_status', e.target.value)} className={inputClass}>
                  <option value="">—</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="uniao_estavel">União estável</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                </select>
              </Field>
              <Field label="Profissão">
                <input disabled={!canEdit} value={form.profession || ''} onChange={(e) => set('profession', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Nome da mãe" className="sm:col-span-2">
                <input disabled={!canEdit} value={form.mother_name || ''} onChange={(e) => set('mother_name', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Nome do pai" className="sm:col-span-2">
                <input disabled={!canEdit} value={form.father_name || ''} onChange={(e) => set('father_name', e.target.value)} className={inputClass} />
              </Field>
            </div>
          </Section>

          <Section title="Contato e endereço">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail *">
                <input type="email" required disabled={!canEdit} value={form.email || ''} onChange={(e) => set('email', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Telefone *">
                <input required disabled={!canEdit} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} className={inputClass} />
              </Field>
              <Field label="WhatsApp">
                <input disabled={!canEdit} value={form.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} className={inputClass} />
              </Field>
              <Field label="CEP *">
                <div className="relative">
                  <input
                    required
                    disabled={!canEdit || cepLoading}
                    value={form.zip_code || ''}
                    onChange={(e) => {
                      const formatted = formatCepInput(e.target.value);
                      set('zip_code', formatted);
                      if (formatted.replace(/\D/g, '').length === 8) applyPersonCep(formatted);
                    }}
                    onBlur={(e) => applyPersonCep(e.target.value)}
                    className={inputClass}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  {cepLoading && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-olive">Buscando...</span>
                  )}
                </div>
                <span className="mt-1 block text-xs text-brand-olive">Ao digitar o CEP, rua, cidade e UF são preenchidos automaticamente.</span>
              </Field>
              <Field label="Cidade *">
                <input required disabled={!canEdit} value={form.city || ''} onChange={(e) => set('city', e.target.value)} className={inputClass} />
              </Field>
              <Field label="UF *">
                <input required disabled={!canEdit} maxLength={2} value={form.state || ''} onChange={(e) => set('state', e.target.value.toUpperCase())} className={inputClass} />
              </Field>
              <Field label="País">
                <input disabled={!canEdit} value={form.country || 'Brasil'} onChange={(e) => set('country', e.target.value)} className={inputClass} />
              </Field>
              <Field label="Endereço (logradouro) *">
                <input required disabled={!canEdit} value={form.address || ''} onChange={(e) => set('address', e.target.value)} className={inputClass} placeholder="Rua, avenida..." />
              </Field>
              <Field label="Número">
                <input disabled={!canEdit} value={form.address_number || ''} onChange={(e) => set('address_number', e.target.value)} className={inputClass} placeholder="Nº" />
              </Field>
            </div>
          </Section>

          {canEdit && (
            <Section title="Papéis">
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
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={!!form.is_avalista} onChange={(e) => set('is_avalista', e.target.checked)} />
                  Avalista
                </label>
              </div>
              {!isNew && (
                <label className="mt-3 flex items-center gap-2 text-sm text-brand-dark-brown/80">
                  <input type="checkbox" checked={form.active !== false} onChange={(e) => set('active', e.target.checked)} />
                  Pessoa ativa
                </label>
              )}
            </Section>
          )}

          {!isNew && canEdit && (
            <Section title="Acesso ao sistema">
              <p className="text-sm text-brand-olive">
                Crie um login para a pessoa acompanhar contratos, animais e cobranças relacionados aos papéis
                selecionados acima.
              </p>
              {partyRoleLabels.length > 0 ? (
                <p className="mt-2 text-xs text-brand-dark-brown/80">
                  Papéis ativos: {partyRoleLabels.join(' · ')}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-700">
                  Marque ao menos um papel (comprador, vendedor, assessor ou testemunha) para orientar o acesso.
                </p>
              )}
              {loadingAccessUser ? (
                <p className="mt-3 text-sm text-brand-olive">Verificando usuário de acesso...</p>
              ) : accessUser ? (
                <div className="mt-4 space-y-4 rounded-xl border border-brand-beige bg-white p-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-brand-dark-brown">Usuário:</span>{' '}
                      <code className="rounded bg-brand-off-white px-1.5 py-0.5">{accessUser.username}</code>
                    </p>
                    <p>
                      <span className="font-medium text-brand-dark-brown">Perfil:</span> Portal do cliente
                    </p>
                    <p>
                      <span className="font-medium text-brand-dark-brown">Status:</span>{' '}
                      {accessUser.active === false ? 'Inativo' : 'Ativo'}
                    </p>
                    <p className="text-brand-olive">
                      Senha inicial padrão: <strong>ariane2026</strong> (se ainda não alterada)
                    </p>
                  </div>
                  <div className="grid gap-3 border-t border-brand-beige pt-4 sm:grid-cols-2">
                    <Field label="Nova senha">
                      <input
                        type="password"
                        value={newAccessPassword}
                        onChange={(e) => setNewAccessPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Mínimo 6 caracteres"
                        autoComplete="new-password"
                      />
                    </Field>
                    <Field label="Confirmar nova senha">
                      <input
                        type="password"
                        value={confirmAccessPassword}
                        onChange={(e) => setConfirmAccessPassword(e.target.value)}
                        className={inputClass}
                        placeholder="Repita a senha"
                        autoComplete="new-password"
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    disabled={savingAccessPassword || !newAccessPassword}
                    onClick={onResetAccessPassword}
                    className="rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-beige/40 disabled:opacity-50"
                  >
                    {savingAccessPassword ? 'Salvando...' : 'Alterar senha de acesso'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={creatingAccessUser}
                  onClick={onCreateAccessUser}
                  className="mt-4 rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-50"
                >
                  {creatingAccessUser ? 'Criando...' : 'Criar usuário de acesso'}
                </button>
              )}
            </Section>
          )}

          <FooterActions
            canEdit={canEdit}
            canDelete={canDelete}
            saving={saving}
            isNew={isNew}
            onDelete={onDelete}
            onClose={onClose}
            submitLabel={isNew ? 'Salvar e continuar' : 'Salvar dados'}
          />
        </form>
      )}

      {tab === 'documentos' && (
        <div className="space-y-4">
          {!currentId && <NeedSaveBanner />}
          {canEdit && currentId && (
            <Section title="Anexar documento">
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Tipo">
                  <select value={docType} onChange={(e) => setDocType(e.target.value as PersonDocType)} className={inputClass}>
                    {Object.entries(DOC_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Field>
                <PhotoPicker
                  onFile={onUploadDoc}
                  disabled={uploading}
                  accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                  cameraLabel={uploading ? 'Enviando…' : 'Tirar foto'}
                  galleryLabel="Galeria / PDF"
                  fileLabel={uploading ? 'Enviando…' : 'Escolher arquivo'}
                />
                <p className="text-xs text-brand-olive">JPG, PNG, WEBP, GIF ou PDF — máx. 8 MB</p>
              </div>
            </Section>
          )}
          {currentId && nestedLoading ? (
            <Loading message="Carregando documentos..." />
          ) : (
            <div className="space-y-2">
              {docs.length === 0 && (
                <p className="py-6 text-center text-sm text-brand-olive">
                  {currentId ? 'Nenhum documento anexado' : 'Após salvar, você poderá anexar RG, CNH, comprovante, selfie e outros.'}
                </p>
              )}
              {docs.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-brand-dark-brown">{DOC_LABELS[d.doc_type] || d.doc_type}</p>
                    <a href={mediaUrl(d.file_url) || '#'} target="_blank" rel="noreferrer" className="text-xs text-brand-olive underline">
                      {d.file_name || 'Abrir arquivo'}
                    </a>
                  </div>
                  {canEdit && currentId && (
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteClientDocument(currentId, d.id);
                        success('Documento removido');
                        loadNested(currentId);
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 border-t border-brand-beige pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">Fechar</button>
          </div>
        </div>
      )}

      {tab === 'propriedades' && (
        <div className="space-y-4">
          {!currentId && <NeedSaveBanner />}
          {canEdit && currentId && (
            <Section title="Nova propriedade / haras">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome *" className="sm:col-span-2">
                  <input value={propForm.name} onChange={(e) => setPropForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
                </Field>
                <Field label="CNPJ"><input value={propForm.cnpj} onChange={(e) => setPropForm((f) => ({ ...f, cnpj: e.target.value }))} className={inputClass} /></Field>
                <Field label="Inscrição estadual"><input value={propForm.state_registration} onChange={(e) => setPropForm((f) => ({ ...f, state_registration: e.target.value }))} className={inputClass} /></Field>
                <Field label="CEP">
                  <div className="relative">
                    <input
                      value={propForm.zip_code}
                      onChange={(e) => {
                        const formatted = formatCepInput(e.target.value);
                        setPropForm((f) => ({ ...f, zip_code: formatted }));
                        if (formatted.replace(/\D/g, '').length === 8) applyPropCep(formatted);
                      }}
                      onBlur={(e) => applyPropCep(e.target.value)}
                      disabled={propCepLoading}
                      className={inputClass}
                      placeholder="00000-000"
                      inputMode="numeric"
                    />
                    {propCepLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-brand-olive">Buscando...</span>
                    )}
                  </div>
                </Field>
                <Field label="UF"><input maxLength={2} value={propForm.state} onChange={(e) => setPropForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))} className={inputClass} /></Field>
                <Field label="Cidade"><input value={propForm.city} onChange={(e) => setPropForm((f) => ({ ...f, city: e.target.value }))} className={inputClass} /></Field>
                <Field label="Telefone"><input value={propForm.phone} onChange={(e) => setPropForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></Field>
                <Field label="Endereço" className="sm:col-span-2"><input value={propForm.address} onChange={(e) => setPropForm((f) => ({ ...f, address: e.target.value }))} className={inputClass} /></Field>
                <Field label="Tipo"><input value={propForm.property_type} onChange={(e) => setPropForm((f) => ({ ...f, property_type: e.target.value }))} className={inputClass} /></Field>
                <Field label="Gerente"><input value={propForm.manager_name} onChange={(e) => setPropForm((f) => ({ ...f, manager_name: e.target.value }))} className={inputClass} /></Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={propForm.is_primary} onChange={(e) => setPropForm((f) => ({ ...f, is_primary: e.target.checked }))} />
                  Propriedade principal
                </label>
              </div>
              <button
                type="button"
                className="mt-3 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  if (!propForm.name.trim()) return toastError('Informe o nome');
                  await createClientProperty(currentId, propForm);
                  success('Propriedade adicionada');
                  setPropForm({
                    name: '', cnpj: '', state_registration: '', zip_code: '', state: '', city: '', address: '',
                    phone: '', property_type: 'Haras', is_primary: false, manager_name: '', manager_phone: '', manager_email: '', notes: '',
                  });
                  loadNested(currentId);
                }}
              >
                Adicionar propriedade
              </button>
            </Section>
          )}
          {currentId && nestedLoading ? <Loading message="..." /> : (
            <div className="space-y-2">
              {props.length === 0 && (
                <p className="py-6 text-center text-sm text-brand-olive">
                  {currentId ? 'Nenhuma propriedade' : 'Após salvar, cadastre haras e fazendas vinculadas.'}
                </p>
              )}
              {props.map((p) => (
                <div key={p.id} className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium">{p.name}{p.is_primary ? ' · principal' : ''}</p>
                      <p className="text-xs text-brand-olive">{[p.city, p.state].filter(Boolean).join(' / ') || '—'}</p>
                    </div>
                    {canEdit && currentId && (
                      <button type="button" className="text-xs text-red-600" onClick={async () => { await deleteClientProperty(currentId, p.id); loadNested(currentId); }}>Remover</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'contas' && (
        <div className="space-y-4">
          {!currentId && <NeedSaveBanner />}
          {canEdit && currentId && (
            <Section title="Nova conta bancária">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Tipo">
                  <select value={bankForm.account_type} onChange={(e) => setBankForm((f) => ({ ...f, account_type: e.target.value as ClientBankAccount['account_type'] }))} className={inputClass}>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="pagamento">Pagamento</option>
                    <option value="outro">Outro</option>
                  </select>
                </Field>
                <Field label="Banco *"><input value={bankForm.bank_name} onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))} className={inputClass} /></Field>
                <Field label="Agência"><input value={bankForm.agency} onChange={(e) => setBankForm((f) => ({ ...f, agency: e.target.value }))} className={inputClass} /></Field>
                <Field label="Conta"><input value={bankForm.account_number} onChange={(e) => setBankForm((f) => ({ ...f, account_number: e.target.value }))} className={inputClass} /></Field>
                <Field label="Titular"><input value={bankForm.holder_name} onChange={(e) => setBankForm((f) => ({ ...f, holder_name: e.target.value }))} className={inputClass} /></Field>
                <Field label="CPF/CNPJ titular"><input value={bankForm.holder_document} onChange={(e) => setBankForm((f) => ({ ...f, holder_document: e.target.value }))} className={inputClass} /></Field>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={bankForm.is_primary} onChange={(e) => setBankForm((f) => ({ ...f, is_primary: e.target.checked }))} />
                  Conta principal (repasses)
                </label>
              </div>
              <button
                type="button"
                className="mt-3 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  if (!bankForm.bank_name.trim()) return toastError('Informe o banco');
                  await createClientBankAccount(currentId, bankForm);
                  success('Conta adicionada');
                  setBankForm({ account_type: 'corrente', bank_name: '', agency: '', account_number: '', holder_name: '', holder_document: '', is_primary: true, notes: '' });
                  loadNested(currentId);
                }}
              >
                Adicionar conta
              </button>
            </Section>
          )}
          {currentId && nestedLoading ? <Loading message="..." /> : (
            <div className="space-y-2">
              {banks.length === 0 && (
                <p className="py-6 text-center text-sm text-brand-olive">
                  {currentId ? 'Nenhuma conta' : 'Após salvar, cadastre contas para repasses.'}
                </p>
              )}
              {banks.map((b) => (
                <div key={b.id} className="flex justify-between rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{b.bank_name}{b.is_primary ? ' · principal' : ''}</p>
                    <p className="text-xs text-brand-olive">Ag {b.agency || '—'} · Cc {b.account_number || '—'} · {b.holder_name || '—'}</p>
                  </div>
                  {canEdit && currentId && (
                    <button type="button" className="text-xs text-red-600" onClick={async () => { await deleteClientBankAccount(currentId, b.id); loadNested(currentId); }}>Remover</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'contatos' && (
        <div className="space-y-4">
          {!currentId && <NeedSaveBanner />}
          {canEdit && currentId && (
            <Section title="Novo contato">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nome *"><input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} /></Field>
                <Field label="Relação / cargo"><input value={contactForm.role_label} onChange={(e) => setContactForm((f) => ({ ...f, role_label: e.target.value }))} className={inputClass} /></Field>
                <Field label="Telefone"><input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} /></Field>
                <Field label="E-mail"><input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} /></Field>
              </div>
              <button
                type="button"
                className="mt-3 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  if (!contactForm.name.trim()) return toastError('Informe o nome');
                  await createClientContact(currentId, contactForm);
                  success('Contato adicionado');
                  setContactForm({ name: '', role_label: '', phone: '', email: '', notes: '' });
                  loadNested(currentId);
                }}
              >
                Adicionar contato
              </button>
            </Section>
          )}
          {currentId && nestedLoading ? <Loading message="..." /> : (
            <div className="space-y-2">
              {contacts.length === 0 && (
                <p className="py-6 text-center text-sm text-brand-olive">
                  {currentId ? 'Nenhum contato extra' : 'Após salvar, adicione contatos adicionais.'}
                </p>
              )}
              {contacts.map((c) => (
                <div key={c.id} className="flex justify-between rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-brand-olive">{[c.role_label, c.phone, c.email].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  {canEdit && currentId && (
                    <button type="button" className="text-xs text-red-600" onClick={async () => { await deleteClientContact(currentId, c.id); loadNested(currentId); }}>Remover</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'observacoes' && (
        <div className="space-y-4">
          {!currentId && (
            <p className="rounded-xl border border-brand-beige bg-brand-off-white/80 px-3 py-2 text-sm text-brand-olive">
              Você pode preencher as observações agora; elas serão gravadas ao salvar na aba Dados.
            </p>
          )}
          <Field label="Histórico / relacionamento">
            <textarea
              disabled={!canEdit}
              rows={4}
              value={form.relationship_notes || ''}
              onChange={(e) => set('relationship_notes', e.target.value)}
              className={inputClass}
              placeholder="Histórico comercial, preferências, combinações..."
            />
          </Field>
          <Field label="Problemas / alertas">
            <textarea
              disabled={!canEdit}
              rows={3}
              value={form.problems_notes || ''}
              onChange={(e) => set('problems_notes', e.target.value)}
              className={inputClass}
              placeholder="Pendências, restrições, observações sensíveis..."
            />
          </Field>
          <Field label="Observações gerais">
            <textarea
              disabled={!canEdit}
              rows={3}
              value={form.notes || ''}
              onChange={(e) => set('notes', e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
            {canEdit && currentId && (
              <button type="button" disabled={saving} onClick={onSaveObservacoes} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar observações'}
              </button>
            )}
            {canEdit && !currentId && (
              <button
                type="button"
                disabled={saving}
                onClick={() => onSubmitDados()}
                className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar pessoa (com observações)'}
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NeedSaveBanner() {
  return (
    <p className="rounded-xl border border-brand-beige bg-brand-off-white/80 px-3 py-2 text-sm text-brand-olive">
      Navegue à vontade. Para anexar arquivos ou cadastrar itens nesta aba, salve a pessoa na aba <strong>Dados</strong> primeiro.
    </p>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-brand-beige/80 bg-brand-off-white/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-brand-olive">{title}</h3>
      {children}
    </section>
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

function FooterActions({
  canEdit, canDelete, saving, isNew, onDelete, onClose, submitLabel,
}: {
  canEdit: boolean;
  canDelete: boolean;
  saving: boolean;
  isNew: boolean;
  onDelete: () => void;
  onClose: () => void;
  submitLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
      {canEdit && (
        <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
          {saving ? 'Salvando...' : submitLabel}
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
  );
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige disabled:bg-brand-off-white';
