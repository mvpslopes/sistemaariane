import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Camera, PawPrint, FileText } from 'lucide-react';
import { deleteAnimal, getAnimals, mediaUrl, type Animal } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import AppButton from '../../components/AppButton';
import Modal from '../../components/Modal';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, sortRows } from '../../hooks/useSortableTable';
import { useAppMobile } from '../../hooks/useAppMobile';
import { clientPortalLabels } from '../../constants/clientPortalLabels';
import { MobileCard } from '../../components/MobileCard';
import AnimalForm from './AnimalForm';
import ContractForm from './ContractForm';

type StatusFilter = 'all' | Animal['status'];
type SortKey = 'name' | 'registration' | 'chip' | 'sex' | 'owners' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'ativo', label: 'Ativos' },
  { id: 'vendido', label: 'Vendidos' },
  { id: 'falecido', label: 'Falecidos' },
  { id: 'transferido', label: 'Transferidos' },
];

const SEX_LABEL: Record<string, string> = { M: 'Macho', F: 'Fêmea', C: 'Castrado' };

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
  const { canCreate, canUpdate, canDelete, hasRole } = useAuth();
  const isCliente = hasRole('cliente');
  const appMobile = useAppMobile();
  const { success, error: toastError } = useToast();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saleAnimalId, setSaleAnimalId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setAnimals(await getAnimals());
    } catch (e: any) {
      toastError(e.message || (isCliente ? clientPortalLabels.loadError : 'Erro ao carregar animais'));
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
    if (!canDelete) return;
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
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao excluir animal');
    } finally {
      setDeletingId(null);
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: animals.length,
      ativo: 0,
      vendido: 0,
      falecido: 0,
      transferido: 0,
    };
    animals.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return counts;
  }, [animals]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = animals.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!search) return true;
      return (
        a.name.toLowerCase().includes(search) ||
        (a.registration_no || '').toLowerCase().includes(search) ||
        (a.chip_no || '').toLowerCase().includes(search) ||
        (a.breed || '').toLowerCase().includes(search) ||
        String(a.owners || '').toLowerCase().includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'name':
          return cmpStr(a.name, b.name);
        case 'registration':
          return cmpStr(a.registration_no, b.registration_no);
        case 'chip':
          return cmpStr(a.chip_no, b.chip_no);
        case 'sex':
          return cmpStr(SEX_LABEL[a.sex || ''] || a.sex, SEX_LABEL[b.sex || ''] || b.sex);
        case 'owners':
          return cmpStr(String(a.owners || ''), String(b.owners || ''));
        case 'status':
          return cmpStr(a.status, b.status);
        default:
          return 0;
      }
    });
  }, [animals, q, statusFilter, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== animals.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{animals.length}</span></>
          ) : null}{' '}
          {isCliente ? clientPortalLabels.countPurchases : 'animais'} ·{' '}
          <span className="font-semibold text-brand-dark-brown">{activeCount}</span>{' '}
          {isCliente ? clientPortalLabels.countActive : 'ativos'}
        </p>
        {canCreate && (
          <AppButton type="button" onClick={openNew}>
            <Plus className="h-4 w-4" /> Novo animal
          </AppButton>
        )}
      </div>

      <ListTableToolbar
        search={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                isCliente
                  ? clientPortalLabels.searchPlaceholder
                  : 'Buscar por nome, registro, chip...'
              }
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
            />
          </div>
        }
        filters={
          <FilterPills
            options={STATUS_FILTERS.map((opt) => ({ ...opt, count: statusCounts[opt.id] }))}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      {loading ? (
        <ListPageSkeleton variant={appMobile ? 'cards' : 'table'} />
      ) : filtered.length === 0 ? (
        <EmptyState isCliente={isCliente} />
      ) : appMobile ? (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <li key={a.id}>
              <MobileCard onClick={() => openEdit(a.id)}>
                <div className="flex items-start gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-beige bg-brand-off-white">
                    {a.photo_url ? (
                      <img src={mediaUrl(a.photo_url) || undefined} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-5 w-5 text-brand-olive/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold text-brand-dark-brown">{a.name}</p>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone[a.status]}`}
                      >
                        {statusLabel[a.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-olive">
                      {a.breed || '—'}
                      {a.registration_no ? ` · Reg. ${a.registration_no}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-brand-olive/80">
                      {SEX_LABEL[a.sex] || '—'}
                      {(a.owners as string) ? ` · ${a.owners}` : ''}
                    </p>
                  </div>
                </div>
              </MobileCard>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh
                  label={isCliente ? clientPortalLabels.tableAnimal : 'Animal'}
                  column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-3 sm:px-4" />
                <SortTh label="Registro" column="registration" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Chip" column="chip" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                <SortTh label="Sexo" column="sex" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden sm:table-cell" />
                <SortTh label="Vendedor(es)" column="owners" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden xl:table-cell" />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-3 sm:px-4" />
                <th className="px-2 py-3 font-medium sm:px-4"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-brand-beige/60 transition-colors hover:bg-brand-off-white/70"
                >
                  <td className="px-3 py-3 sm:px-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-beige bg-brand-off-white">
                        {a.photo_url ? (
                          <img src={mediaUrl(a.photo_url) || undefined} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Camera className="h-4 w-4 text-brand-olive/40" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-brand-dark-brown">{a.name}</span>
                        <span className="text-[11px] text-brand-olive sm:hidden">
                          {a.sex === 'M' ? 'Macho' : a.sex === 'F' ? 'Fêmea' : a.sex === 'C' ? 'Castrado' : '—'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{a.registration_no || '—'}</td>
                  <td className="hidden px-4 py-3 text-brand-brown lg:table-cell">{a.chip_no || '—'}</td>
                  <td className="hidden px-4 py-3 text-brand-brown sm:table-cell">
                    {a.sex === 'M' ? 'Macho' : a.sex === 'F' ? 'Fêmea' : a.sex === 'C' ? 'Castrado' : '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown xl:table-cell">{(a.owners as string) || '—'}</td>
                  <td className="px-3 py-3 sm:px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium sm:px-2.5 sm:text-xs ${statusTone[a.status]}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDot[a.status]}`} />
                      {statusLabel[a.status] ?? a.status}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right sm:px-4">
                    <div className="inline-flex items-center gap-0.5 sm:gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(a.id)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-brand-brown hover:bg-brand-beige/50"
                        title={canUpdate ? 'Editar' : 'Ver'}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">{canUpdate ? 'Editar' : 'Ver'}</span>
                      </button>
                      {canUpdate && a.status === 'ativo' && (
                        <button
                          type="button"
                          onClick={() => setSaleAnimalId(a.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-brand-gold hover:bg-brand-gold/10"
                          title="Gerar venda"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="hidden sm:inline">Venda</span>
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(a)}
                          disabled={deletingId === a.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir animal"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden sm:inline">{deletingId === a.id ? '...' : 'Excluir'}</span>
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
        title={editingId ? 'Editar animal' : 'Novo animal'}
        subtitle="Ficha básica do plantel"
        size="xl"
      >
        <AnimalForm animalId={editingId} onClose={closeModal} onSaved={() => load()} />
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
            load();
          }}
        />
      </Modal>
    </div>
  );
}

function EmptyState({ isCliente = false }: { isCliente?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-beige bg-white py-16 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-off-white text-brand-olive">
        <PawPrint className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-brand-dark-brown">
        {isCliente ? clientPortalLabels.emptyPurchases : 'Nenhum animal encontrado'}
      </p>
      <p className="max-w-xs text-xs text-brand-olive">
        {isCliente
          ? clientPortalLabels.emptyPurchasesHint
          : 'Ajuste a busca ou cadastre um novo animal para começar.'}
      </p>
    </div>
  );
}
