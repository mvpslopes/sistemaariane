import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { deleteClient, getClients, type Client } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import ClientForm from './ClientForm';

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
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      setClients(await getClients(search));
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar clientes');
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
    if (!canWrite) return;
    if (
      !confirm(
        `Excluir o cliente "${client.name}" definitivamente?\n\nEle será removido dos proprietários dos animais vinculados. Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(client.id);
    try {
      await deleteClient(client.id);
      success('Cliente excluído');
      await load(q);
    } catch (e: any) {
      toastError(e.message || 'Erro ao excluir cliente');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{clients.length}</span> clientes ·{' '}
          <span className="font-semibold text-brand-dark-brown">{activeCount}</span> ativos
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 transition hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Novo cliente
          </button>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, documento, e-mail..."
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
          />
        </div>
        <button type="submit" className="rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium hover:bg-brand-off-white">
          Buscar
        </button>
      </form>

      {loading ? (
        <Loading message="Carregando clientes..." />
      ) : clients.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Contato</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Cidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  className="border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${avatarTone(c.name)}`}
                      >
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-brand-dark-brown">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brand-brown">
                    {c.document_type} {c.document || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">
                    {c.whatsapp || c.phone || c.email || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown lg:table-cell">
                    {[c.city, c.state].filter(Boolean).join('/') || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge active={c.active} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(c.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand-brown hover:bg-brand-beige/50"
                      >
                        <Pencil className="h-4 w-4" />
                        {canWrite ? 'Editar' : 'Ver'}
                      </button>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => onDelete(c)}
                          disabled={deletingId === c.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir cliente"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === c.id ? '...' : 'Excluir'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar cliente' : 'Novo cliente'}
        subtitle="Dados do criador / proprietário"
        size="xl"
      >
        <ClientForm clientId={editingId} onClose={closeModal} onSaved={() => load(q)} />
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-beige bg-white py-16 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-off-white text-brand-olive">
        <Users className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-brand-dark-brown">Nenhum cliente encontrado</p>
      <p className="max-w-xs text-xs text-brand-olive">
        Ajuste a busca ou cadastre um novo cliente para começar.
      </p>
    </div>
  );
}
