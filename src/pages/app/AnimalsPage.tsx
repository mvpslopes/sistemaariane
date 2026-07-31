import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Camera, PawPrint, FileText } from 'lucide-react';
import { deleteAnimal, getAnimals, mediaUrl, type Animal } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import AnimalForm from './AnimalForm';
import ContractForm from './ContractForm';

const statusTone: Record<Animal['status'], string> = {
  ativo: 'bg-emerald-50 text-emerald-700',
  vendido: 'bg-brand-gold/15 text-brand-gold',
  falecido: 'bg-brand-beige/60 text-brand-olive',
  transferido: 'bg-brand-beige/60 text-brand-olive',
};

const statusDot: Record<Animal['status'], string> = {
  ativo: 'bg-emerald-500',
  vendido: 'bg-brand-gold',
  falecido: 'bg-brand-olive/60',
  transferido: 'bg-brand-olive/60',
};

const statusLabel: Record<Animal['status'], string> = {
  ativo: 'Ativo',
  vendido: 'Vendido',
  falecido: 'Falecido',
  transferido: 'Transferido',
};

export default function AnimalsPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saleAnimalId, setSaleAnimalId] = useState<string | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      setAnimals(await getAnimals(search));
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar animais');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = useMemo(() => animals.filter((a) => a.status === 'ativo').length, [animals]);

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

  const onDelete = async (animal: Animal) => {
    if (!canWrite) return;
    if (
      !confirm(
        `Excluir o animal "${animal.name}" definitivamente?\n\nA ficha, vínculos e a foto serão removidos. Esta ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeletingId(animal.id);
    try {
      await deleteAnimal(animal.id);
      success('Animal excluído');
      await load(q);
    } catch (e: any) {
      toastError(e.message || 'Erro ao excluir animal');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{animals.length}</span> animais ·{' '}
          <span className="font-semibold text-brand-dark-brown">{activeCount}</span> ativos
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 transition hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Novo animal
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
            placeholder="Buscar por nome, registro, chip..."
            className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
          />
        </div>
        <button type="submit" className="rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium hover:bg-brand-off-white">
          Buscar
        </button>
      </form>

      {loading ? (
        <Loading message="Carregando animais..." />
      ) : animals.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Registro</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Chip</th>
                <th className="px-4 py-3 font-medium">Sexo</th>
                <th className="hidden px-4 py-3 font-medium xl:table-cell">Proprietário(s)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-beige bg-brand-off-white">
                        {a.photo_url ? (
                          <img src={mediaUrl(a.photo_url) || undefined} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-4 w-4 text-brand-olive/40" />
                        )}
                      </div>
                      <span className="font-medium text-brand-dark-brown">{a.name}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{a.registration_no || '—'}</td>
                  <td className="hidden px-4 py-3 text-brand-brown lg:table-cell">{a.chip_no || '—'}</td>
                  <td className="px-4 py-3 text-brand-brown">
                    {a.sex === 'M' ? 'Macho' : a.sex === 'F' ? 'Fêmea' : a.sex === 'C' ? 'Castrado' : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown xl:table-cell">{(a.owners as string) || '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[a.status]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[a.status]}`} />
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(a.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand-brown hover:bg-brand-beige/50"
                      >
                        <Pencil className="h-4 w-4" />
                        {canWrite ? 'Editar' : 'Ver'}
                      </button>
                      {canWrite && a.status === 'ativo' && (
                        <button
                          type="button"
                          onClick={() => setSaleAnimalId(a.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand-gold hover:bg-brand-gold/10"
                          title="Gerar venda"
                        >
                          <FileText className="h-4 w-4" />
                          Venda
                        </button>
                      )}
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => onDelete(a)}
                          disabled={deletingId === a.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir animal"
                        >
                          <Trash2 className="h-4 w-4" />
                          {deletingId === a.id ? '...' : 'Excluir'}
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
        title={editingId ? 'Editar animal' : 'Novo animal'}
        subtitle="Ficha básica do plantel"
        size="xl"
      >
        <AnimalForm animalId={editingId} onClose={closeModal} onSaved={() => load(q)} />
      </Modal>

      <Modal
        open={!!saleAnimalId}
        onClose={() => setSaleAnimalId(null)}
        title="Gerar venda"
        subtitle="Contrato + cobranças deste animal"
        size="xl"
      >
        <ContractForm
          animalId={saleAnimalId}
          onClose={() => setSaleAnimalId(null)}
          onSaved={() => {
            setSaleAnimalId(null);
            load(q);
          }}
        />
      </Modal>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-beige bg-white py-16 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-off-white text-brand-olive">
        <PawPrint className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-brand-dark-brown">Nenhum animal encontrado</p>
      <p className="max-w-xs text-xs text-brand-olive">
        Ajuste a busca ou cadastre um novo animal para começar.
      </p>
    </div>
  );
}
