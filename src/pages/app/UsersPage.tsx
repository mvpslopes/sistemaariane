import { useEffect, useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import {
  createUser,
  deleteUser,
  getClients,
  getUsers,
  updateUser,
  type AuthUser,
  type Client,
  type Role,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import UserAvatar from '../../components/UserAvatar';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, sortRows } from '../../hooks/useSortableTable';

type StatusFilter = 'all' | 'active' | 'inactive';
type RoleFilter = 'all' | Role;
type SortKey = 'name' | 'username' | 'role' | 'client' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'Todos os perfis' },
  { id: 'root', label: 'Root' },
  { id: 'admin', label: 'Admin' },
  { id: 'user', label: 'Usuário' },
  { id: 'cliente', label: 'Cliente' },
];

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
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const canDelete = (u: AuthUser) => {
    if (me?.id === u.id) return false;
    if (me?.role === 'admin' && (u.role === 'root' || u.role === 'admin')) return false;
    return true;
  };

  const onDelete = async (u: AuthUser) => {
    if (!canDelete(u)) return;
    if (
      !confirm(
        `Excluir o usuário "${u.name}" (@${u.username})?\n\nEsta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(u.id);
    try {
      await deleteUser(u.id);
      success('Usuário excluído');
      await load();
    } catch (err: any) {
      toastError(err.message || 'Erro ao excluir usuário');
    } finally {
      setDeletingId(null);
    }
  };

  const availableRoles =
    me?.role === 'root'
      ? [{ value: 'root' as Role, label: 'Root' }, ...roleOptions]
      : roleOptions;

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: users.length, active: 0, inactive: 0 };
    users.forEach((u) => {
      if (u.active !== false) counts.active += 1;
      else counts.inactive += 1;
    });
    return counts;
  }, [users]);

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      all: users.length,
      root: 0,
      admin: 0,
      user: 0,
      cliente: 0,
    };
    users.forEach((u) => {
      if (counts[u.role] !== undefined) counts[u.role] += 1;
    });
    return counts;
  }, [users]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return sortRows(
      users.filter((u) => {
        if (statusFilter === 'active' && u.active === false) return false;
        if (statusFilter === 'inactive' && u.active !== false) return false;
        if (roleFilter !== 'all' && u.role !== roleFilter) return false;
        if (!search) return true;
        const clientName = u.clientId ? clientNameById.get(u.clientId) || '' : '';
        return (
          u.name.toLowerCase().includes(search) ||
          u.username.toLowerCase().includes(search) ||
          clientName.toLowerCase().includes(search)
        );
      }),
      sortKey,
      sortDir,
      (a, b, key) => {
        switch (key as SortKey) {
          case 'name':
            return cmpStr(a.name, b.name);
          case 'username':
            return cmpStr(a.username, b.username);
          case 'role':
            return cmpStr(a.role, b.role);
          case 'client':
            return cmpStr(
              a.clientId ? clientNameById.get(a.clientId) : '',
              b.clientId ? clientNameById.get(b.clientId) : ''
            );
          case 'status':
            return Number(b.active !== false) - Number(a.active !== false);
          default:
            return 0;
        }
      }
    );
  }, [users, q, statusFilter, roleFilter, sortKey, sortDir, clientNameById]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-5 w-40 rounded-lg bg-brand-beige/50" />
          <div className="h-10 w-32 rounded-xl bg-brand-beige/50" />
        </div>
        <ListPageSkeleton variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== users.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{users.length}</span></>
          ) : null}{' '}
          usuários cadastrados
        </p>
        <AppButton type="button" onClick={openNew}>
          Novo usuário
        </AppButton>
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, usuário ou cliente..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <>
            <FilterPills
              options={STATUS_FILTERS.map((opt) => ({ ...opt, count: statusCounts[opt.id] }))}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterPills
              options={ROLE_FILTERS.filter((opt) => opt.id !== 'root' || me?.role === 'root').map((opt) => ({
                ...opt,
                count: roleCounts[opt.id],
              }))}
              value={roleFilter}
              onChange={setRoleFilter}
            />
          </>
        }
      />

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
              <SortTh label="Nome" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Usuário" column="username" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Perfil" column="role" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <SortTh label="Cliente vinculado" column="client" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
              <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                  Nenhum usuário encontrado
                </td>
              </tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={u.name} size="md" />
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
                  <div className="inline-flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-lg px-2 py-1 text-brand-brown hover:bg-brand-beige/50 hover:underline"
                    >
                      Editar
                    </button>
                    {canDelete(u) && (
                      <button
                        type="button"
                        onClick={() => onDelete(u)}
                        disabled={deletingId === u.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                        title="Excluir"
                        aria-label="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
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
