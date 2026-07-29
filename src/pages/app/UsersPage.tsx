import { useEffect, useMemo, useState } from 'react';
import {
  createUser,
  getClients,
  getUsers,
  updateUser,
  type AuthUser,
  type Client,
  type Role,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Usuário' },
  { value: 'cliente', label: 'Cliente' },
];

const roleLabel: Record<Role, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Usuário',
  cliente: 'Cliente',
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const { success, error: toastError } = useToast();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState({
    username: '',
    name: '',
    password: '',
    role: 'user' as Role,
    clientId: '',
    active: true,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([getUsers(), getClients()]);
      setUsers(u);
      setClients(c);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeClients = useMemo(() => clients.filter((c) => c.active), [clients]);

  const clientNameById = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [clients]);

  const openNew = () => {
    setEditing(null);
    setForm({
      username: '',
      name: '',
      password: '',
      role: 'user',
      clientId: '',
      active: true,
    });
    setShowForm(true);
  };

  const openEdit = (u: AuthUser) => {
    setEditing(u);
    setForm({
      username: u.username,
      name: u.name,
      password: '',
      role: u.role,
      clientId: u.clientId || '',
      active: u.active !== false,
    });
    setShowForm(true);
  };

  const setRole = (role: Role) => {
    setForm((prev) => ({
      ...prev,
      role,
      clientId: role === 'cliente' ? prev.clientId : '',
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.role === 'cliente' && !form.clientId) {
      toastError('Selecione o cliente vinculado a este acesso');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        username: form.username.trim(),
        name: form.name.trim(),
        email: null as string | null,
        role: form.role,
        clientId: form.role === 'cliente' ? form.clientId : null,
        active: form.active,
        ...(form.password ? { password: form.password } : {}),
      };

      if (editing) {
        await updateUser(editing.id, payload);
        success('Usuário atualizado com sucesso');
      } else {
        if (!form.password) throw new Error('Senha é obrigatória');
        await createUser({ ...payload, password: form.password });
        success('Usuário cadastrado com sucesso');
      }
      setShowForm(false);
      await load();
    } catch (err: any) {
      toastError(err.message || 'Erro ao salvar usuário');
    } finally {
      setSaving(false);
    }
  };

  const availableRoles =
    me?.role === 'root'
      ? [{ value: 'root' as Role, label: 'Root' }, ...roleOptions]
      : roleOptions;

  if (loading) return <Loading message="Carregando usuários..." />;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{users.length}</span> usuários cadastrados
        </p>
        <button
          type="button"
          onClick={openNew}
          className="rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 transition hover:bg-brand-olive"
        >
          Novo usuário
        </button>
      </div>

      {showForm && (
        <Modal
          open={showForm}
          onClose={() => setShowForm(false)}
          title={editing ? 'Editar usuário' : 'Novo usuário'}
          subtitle="Defina acesso e perfil no sistema"
          size="lg"
        >
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Usuário *</span>
                <input
                  required
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className={inputClass}
                  placeholder="ex.: thaty"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Nome *</span>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
                  Senha {editing ? '(deixe em branco para manter)' : '*'}
                </span>
                <input
                  type="password"
                  required={!editing}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">Perfil *</span>
                <select
                  value={form.role}
                  onChange={(e) => setRole(e.target.value as Role)}
                  className={inputClass}
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>

              {form.role === 'cliente' && (
                <label className="block space-y-1.5 sm:col-span-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-brand-olive">
                    Cliente vinculado *
                  </span>
                  <select
                    required
                    value={form.clientId}
                    onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">— Selecionar cliente —</option>
                    {activeClients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <span className="block text-xs text-brand-olive">
                    Ao logar, este usuário verá apenas os animais vinculados a este cliente.
                  </span>
                  {activeClients.length === 0 && (
                    <span className="block text-xs text-red-600">
                      Nenhum cliente ativo cadastrado. Cadastre um cliente antes de criar o acesso.
                    </span>
                  )}
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-brand-dark-brown/80 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                Usuário ativo
              </label>
            </div>
            <div className="flex gap-2 border-t border-brand-beige pt-4">
              <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-brand-beige px-5 py-2.5 text-sm">
                Cancelar
              </button>
            </div>
          </form>
        </Modal>
      )}

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Usuário</th>
              <th className="px-4 py-3 font-medium">Perfil</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Cliente vinculado</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-olive/20 text-xs font-semibold text-brand-olive">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-brand-dark-brown">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-brand-brown">@{u.username}</td>
                <td className="px-4 py-3 text-brand-brown">{roleLabel[u.role] || u.role}</td>
                <td className="hidden px-4 py-3 text-brand-brown md:table-cell">
                  {u.role === 'cliente'
                    ? (u.clientId && clientNameById.get(u.clientId)) || '—'
                    : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${u.active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-beige/60 text-brand-olive'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${u.active !== false ? 'bg-emerald-500' : 'bg-brand-olive/60'}`} />
                    {u.active !== false ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => openEdit(u)} className="rounded-lg px-2 py-1 text-brand-brown hover:bg-brand-beige/50 hover:underline">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';
