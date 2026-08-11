import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { deleteClient, getClients, type Client } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, sortRows } from '../../hooks/useSortableTable';
import ClientForm from './ClientForm';

type StatusFilter = 'all' | 'active' | 'inactive';
type RoleFilter = 'all' | 'buyer' | 'seller' | 'assessor' | 'witness' | 'avalista';
type SortKey = 'name' | 'property' | 'document' | 'contact' | 'city' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'active', label: 'Ativos' },
  { id: 'inactive', label: 'Inativos' },
];

const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: 'all', label: 'Todos os papéis' },
  { id: 'buyer', label: 'Compradores' },
  { id: 'seller', label: 'Vendedores' },
  { id: 'assessor', label: 'Assessores' },
  { id: 'witness', label: 'Testemunhas' },
  { id: 'avalista', label: 'Avalistas' },
];

function matchesRoleFilter(client: Client, filter: RoleFilter) {
  if (filter === 'all') return true;
  if (filter === 'buyer') return !!client.is_buyer;
  if (filter === 'seller') return !!client.is_seller;
  if (filter === 'assessor') return !!client.is_assessor;
  if (filter === 'witness') return !!client.is_witness;
  return !!client.is_avalista;
}

const avatarPalette = [
  'bg-brand-gold/20 text-brand-gold',
  'bg-brand-forest/20 text-brand-forest',
  'bg-brand-brown/20 text-brand-brown',
  'bg-brand-olive/25 text-brand-olive',
];

function avatarTone(seed: string) {
  const idx = seed.charCodeAt(0) % avatarPalette.length;
  return avatarPalette[idx];
}

export default function ClientsPage() {
  const { canCreate, canUpdate, canDelete } = useAuth();
  const { success, error: toastError } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setClients(await getClients());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar pessoas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = useMemo(() => clients.filter((c) => c.active).length, [clients]);

  const openNew = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const onDelete = async (client: Client) => {
    if (!canDelete) return;
    if (
      !confirm(
        `Excluir "${client.name}" definitivamente?\n\nSerá removido dos proprietários dos animais vinculados. Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      success('Pessoa excluída');
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao excluir');
    } finally {
      setDeletingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = { all: clients.length, active: 0, inactive: 0 };
    clients.forEach((c) => {
      if (c.active) counts.active += 1;
      else counts.inactive += 1;
    });
    return counts;
  }, [clients]);

  const roleCounts = useMemo(() => {
    const counts: Record<RoleFilter, number> = {
      all: clients.length,
      buyer: 0,
      seller: 0,
      assessor: 0,
      witness: 0,
      avalista: 0,
    };
    clients.forEach((c) => {
      if (c.is_buyer) counts.buyer += 1;
      if (c.is_seller) counts.seller += 1;
      if (c.is_assessor) counts.assessor += 1;
      if (c.is_witness) counts.witness += 1;
      if (c.is_avalista) counts.avalista += 1;
    });
    return counts;
  }, [clients]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = clients.filter((c) => {
      if (statusFilter === 'active' && !c.active) return false;
      if (statusFilter === 'inactive' && c.active) return false;
      if (!matchesRoleFilter(c, roleFilter)) return false;
      if (!search) return true;
      const hay = [
        c.name,
        c.property_name,
        c.document,
        c.email,
        c.phone,
        c.whatsapp,
        c.city,
        c.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(search);
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'name':
          return cmpStr(a.name, b.name);
        case 'property':
          return cmpStr(a.property_name, b.property_name);
        case 'document':
          return cmpStr(a.document, b.document);
        case 'contact':
          return cmpStr(a.whatsapp || a.phone || a.email, b.whatsapp || b.phone || b.email);
        case 'city':
          return cmpStr([a.city, a.state].filter(Boolean).join('/'), [b.city, b.state].filter(Boolean).join('/'));
        case 'status':
          return Number(b.active) - Number(a.active);
        default:
          return 0;
      }
    });
  }, [clients, q, statusFilter, roleFilter, sortKey, sortDir]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== clients.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{clients.length}</span></>
          ) : null}{' '}
          pessoas ·{' '}
          <span className="font-semibold text-brand-dark-brown">{activeCount}</span> ativas
        </p>
        {canCreate && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 transition hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Nova pessoa
          </button>
        )}
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, haras, documento, e-mail..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
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
              options={ROLE_FILTERS.map((opt) => ({ ...opt, count: roleCounts[opt.id] }))}
              value={roleFilter}
              onChange={setRoleFilter}
            />
          </>
        }
      />

      {loading ? (
        <Loading message="Carregando pessoas..." />
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh label="Nome" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="min-w-[200px] max-w-[280px] px-3 sm:px-4" />
                <SortTh label="Propriedade" column="property" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden min-w-[140px] md:table-cell" />
                <SortTh label="Documento" column="document" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden min-w-[120px] xl:table-cell" />
                <SortTh label="Contato" column="contact" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden min-w-[120px] 2xl:table-cell" />
                <SortTh label="Cidade" column="city" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden min-w-[100px] 2xl:table-cell" />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="w-[88px] px-3 sm:px-4" />
                <th className="sticky right-0 z-20 w-[96px] bg-brand-off-white px-2 py-3 text-right font-medium shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] sm:w-[108px] sm:px-4">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="group border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70"
                >
                  <td className="min-w-[200px] max-w-[280px] px-3 py-3 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(c.name)}`}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-brand-dark-brown" title={c.name}>
                          {c.name}
                        </span>
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.is_buyer && <RoleChip label="Comprador" />}
                          {c.is_seller && <RoleChip label="Vendedor" />}
                          {c.is_assessor && <RoleChip label="Assessor" />}
                          {c.is_witness && <RoleChip label="Testemunha" />}
                          {c.is_avalista && <RoleChip label="Avalista" />}
                          {!c.is_buyer && !c.is_seller && !c.is_assessor && !c.is_witness && !c.is_avalista && (
                            <span className="text-[10px] text-brand-olive/60">Sem papel</span>
                          )}
                        </div>
                        {c.property_name && (
                          <p className="mt-0.5 truncate text-[11px] text-brand-olive lg:hidden" title={c.property_name}>
                            {c.property_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden max-w-[180px] truncate px-4 py-3 text-brand-brown lg:table-cell" title={c.property_name || undefined}>
                    {c.property_name || '—'}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-brand-brown xl:table-cell">
                    <span className="block max-w-[140px] truncate" title={`${c.document_type} ${c.document || ''}`}>
                      {c.document_type} {c.document || '—'}
                    </span>
                  </td>
                  <td className="hidden max-w-[160px] truncate px-4 py-3 text-brand-brown 2xl:table-cell" title={c.whatsapp || c.phone || c.email || undefined}>
                    {c.whatsapp || c.phone || c.email || '—'}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-brand-brown 2xl:table-cell">
                    {[c.city, c.state].filter(Boolean).join('/') || '—'}
                  </td>
                  <td className="px-3 py-3 sm:px-4">
                    <StatusBadge active={c.active} />
                  </td>
                  <td className="sticky right-0 z-10 bg-white px-2 py-3 text-right shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)] group-hover:bg-brand-off-white/70 sm:px-4">
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openEdit(c.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-brown hover:bg-brand-beige/50"
                        title={canUpdate ? 'Editar' : 'Ver'}
                        aria-label={canUpdate ? 'Editar' : 'Ver'}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(c)}
                          disabled={deletingId === c.id}
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
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar pessoa' : 'Nova pessoa'}
        subtitle="Uma pessoa pode ser comprador, vendedor, assessor, testemunha e/ou avalista ao mesmo tempo"
        size="2xl"
      >
        <ClientForm clientId={editingId} onClose={closeModal} onSaved={() => load()} />
      </Modal>
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-beige/60 text-brand-olive'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-brand-olive/60'}`} />
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}

function RoleChip({ label }: { label: string }) {
  return (
    <span className="rounded bg-brand-beige/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand-olive">
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-beige bg-white py-16 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-off-white text-brand-olive">
        <Users className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-brand-dark-brown">Nenhuma pessoa encontrada</p>
      <p className="max-w-xs text-xs text-brand-olive">
        Cadastre compradores, vendedores e assessores no mesmo lugar. Marque os papéis no formulário.
      </p>
    </div>
  );
}
