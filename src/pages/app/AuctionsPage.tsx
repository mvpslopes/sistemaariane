import { useEffect, useMemo, useState } from 'react';
import { Gavel, Pencil, Plus, Search } from 'lucide-react';
import {
  createAuction,
  createAuctionLot,
  getAnimal,
  getAnimals,
  getAuction,
  getAuctions,
  getClients,
  updateAuction,
  type Animal,
  type Auction,
  type AuctionLot,
  type AuctionStatus,
  type Client,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import DetailSkeleton from '../../components/skeletons/DetailSkeleton';
import Modal from '../../components/Modal';
import { FilterPills } from '../../components/FilterPills';
import { ListTableToolbar } from '../../components/ListTableToolbar';
import { SortTh } from '../../components/SortTh';
import { useSortableTable, cmpStr, cmpNum, sortRows } from '../../hooks/useSortableTable';
import { formatDateBR } from '../../utils/dateTime';
import ContractForm from './ContractForm';

type StatusFilter = 'all' | 'agendado' | 'em_andamento' | 'encerrado' | 'cancelado';
type SortKey = 'name' | 'date' | 'location' | 'lots' | 'status';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'agendado', label: 'Agendados' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'encerrado', label: 'Encerrados' },
  { id: 'cancelado', label: 'Cancelados' },
];

const STATUS_ORDER: Record<AuctionStatus, number> = {
  rascunho: 0,
  agendado: 1,
  em_andamento: 2,
  encerrado: 3,
  cancelado: 4,
};

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';

const emptyAuctionForm = {
  name: '',
  auctionDate: '',
  location: '',
  organizer: '',
  status: 'agendado' as AuctionStatus,
  notes: '',
};

const statusLabel: Record<AuctionStatus, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  encerrado: 'Encerrado',
  cancelado: 'Cancelado',
};

const lotStatusLabel: Record<string, string> = {
  disponivel: 'Disponível',
  arrematado: 'Arrematado',
  retirado: 'Retirado',
};

const money = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function AuctionsPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { sortKey, sortDir, toggleSort } = useSortableTable<SortKey>();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Auction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [arremateLot, setArremateLot] = useState<AuctionLot | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [sellers, setSellers] = useState<Client[]>([]);
  const [animalOwnerIds, setAnimalOwnerIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [auctionForm, setAuctionForm] = useState(emptyAuctionForm);
  const [lotForm, setLotForm] = useState({
    animalId: '',
    sellerIds: [] as string[],
    lotNumber: '',
    minPrice: '',
    conditionsText: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getAuctions());
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar leilões');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    try {
      setDetail(await getAuction(id));
    } catch (e: any) {
      toastError(e.message || 'Erro ao abrir leilão');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailId) return;
    setDetail(await getAuction(detailId));
  };

  const openCreateAuction = () => {
    setEditingId(null);
    setAuctionForm(emptyAuctionForm);
    setFormOpen(true);
  };

  const openEditAuction = (a: Auction) => {
    setEditingId(a.id);
    setAuctionForm({
      name: a.name || '',
      auctionDate: a.auction_date || '',
      location: a.location || '',
      organizer: a.organizer || '',
      status: a.status,
      notes: a.notes || '',
    });
    setFormOpen(true);
  };

  const closeAuctionForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setAuctionForm(emptyAuctionForm);
  };

  const saveAuctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    const payload = {
      name: auctionForm.name,
      auctionDate: auctionForm.auctionDate || null,
      location: auctionForm.location || null,
      organizer: auctionForm.organizer || null,
      status: auctionForm.status,
      notes: auctionForm.notes || null,
    };
    try {
      if (editingId) {
        const id = editingId;
        await updateAuction(id, payload);
        success('Leilão atualizado');
        closeAuctionForm();
        await load();
        if (detailId === id) await refreshDetail();
      } else {
        const res = await createAuction(payload);
        success('Leilão cadastrado');
        closeAuctionForm();
        await load();
        openDetail(res.id);
      }
    } catch (err: any) {
      toastError(err.message || (editingId ? 'Erro ao atualizar leilão' : 'Erro ao criar leilão'));
    } finally {
      setSaving(false);
    }
  };

  const openLotForm = async () => {
    try {
      const [a, s] = await Promise.all([getAnimals(), getClients(undefined, 'seller')]);
      setAnimals(a.filter((x) => x.status === 'ativo'));
      let sellersList = s.filter((c) => c.active);
      if (!sellersList.length) sellersList = (await getClients()).filter((c) => c.active);
      setSellers(sellersList);
      setAnimalOwnerIds([]);
      setLotForm({ animalId: '', sellerIds: [], lotNumber: '', minPrice: '', conditionsText: '' });
      setLotOpen(true);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar dados do lote');
    }
  };

  const onLotAnimalChange = async (animalId: string) => {
    setLotForm((f) => ({ ...f, animalId, sellerIds: [] }));
    setAnimalOwnerIds([]);
    if (!animalId) return;
    try {
      const animal = await getAnimal(animalId);
      const owners = animal.owners || [];
      setAnimalOwnerIds(owners.map((o) => o.clientId));
      setSellers((prev) => {
        const extras = owners
          .filter((o) => !prev.some((c) => c.id === o.clientId))
          .map(
            (o) =>
              ({
                id: o.clientId,
                name: o.clientName,
                document_type: 'CPF',
                document: null,
                email: null,
                phone: null,
                whatsapp: null,
                city: null,
                state: null,
                address: null,
                notes: null,
                active: true,
              }) as Client
          );
        return extras.length ? [...prev, ...extras] : prev;
      });
      if (owners.length) {
        const ordered = [
          ...owners.filter((o) => o.isPrimary),
          ...owners.filter((o) => !o.isPrimary),
        ];
        setLotForm((f) => ({
          ...f,
          animalId,
          sellerIds: ordered.map((o) => o.clientId),
        }));
      }
    } catch {
      /* vendedor permanece manual */
    }
  };

  const toggleLotSeller = (clientId: string) => {
    setLotForm((f) => {
      const has = f.sellerIds.includes(clientId);
      const sellerIds = has ? f.sellerIds.filter((id) => id !== clientId) : [...f.sellerIds, clientId];
      return { ...f, sellerIds };
    });
  };

  const createLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !detailId) return;
    if (!lotForm.sellerIds.length) {
      toastError('Selecione ao menos um vendedor');
      return;
    }
    setSaving(true);
    try {
      await createAuctionLot({
        auctionId: detailId,
        animalId: lotForm.animalId,
        sellerIds: lotForm.sellerIds,
        sellerId: lotForm.sellerIds[0],
        lotNumber: lotForm.lotNumber || null,
        minPrice: lotForm.minPrice || null,
        conditionsText: lotForm.conditionsText || null,
      });
      success('Lote adicionado');
      setLotOpen(false);
      await refreshDetail();
      await load();
    } catch (err: any) {
      toastError(err.message || 'Erro ao criar lote');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: AuctionStatus) => {
    if (!detailId || !canWrite) return;
    try {
      await updateAuction(detailId, { status });
      success('Status do leilão atualizado');
      await refreshDetail();
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar');
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: items.length,
      agendado: 0,
      em_andamento: 0,
      encerrado: 0,
      cancelado: 0,
    };
    items.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    let list = items.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!search) return true;
      return (
        a.name.toLowerCase().includes(search) ||
        (a.location || '').toLowerCase().includes(search) ||
        (a.organizer || '').toLowerCase().includes(search)
      );
    });

    return sortRows(list, sortKey, sortDir, (a, b, key) => {
      switch (key as SortKey) {
        case 'name':
          return cmpStr(a.name, b.name);
        case 'date':
          return cmpStr(a.auction_date, b.auction_date);
        case 'location':
          return cmpStr(a.location, b.location);
        case 'lots':
          return cmpNum(a.lots_count ?? 0, b.lots_count ?? 0);
        case 'status':
          return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        default:
          return 0;
      }
    });
  }, [items, q, statusFilter, sortKey, sortDir]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{filtered.length}</span>
          {filtered.length !== items.length ? (
            <> de <span className="font-semibold text-brand-dark-brown">{items.length}</span></>
          ) : null}{' '}
          leilões · Cadastro de leilões e lotes. O leilão ao vivo fica fora do sistema.
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={openCreateAuction}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Novo leilão
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
              placeholder="Filtrar por nome, local ou organizador..."
              className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
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
        <ListPageSkeleton variant="table" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <SortTh label="Leilão" column="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-3 sm:px-4" />
                <SortTh label="Data" column="date" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Local" column="location" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="hidden lg:table-cell" />
                <SortTh label="Lotes" column="lots" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-3 sm:px-4" />
                <SortTh label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} className="px-3 sm:px-4" />
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum leilão encontrado
                  </td>
                </tr>
              )}
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="cursor-pointer border-t border-brand-beige/70 hover:bg-brand-off-white/50"
                  onClick={() => openDetail(a.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-brand-dark-brown">
                      <Gavel className="h-4 w-4 text-brand-olive" />
                      {a.name}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {a.auction_date
                      ? formatDateBR(a.auction_date)
                      : '—'}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">{a.location || '—'}</td>
                  <td className="px-4 py-3">{a.lots_count ?? 0}</td>
                  <td className="px-4 py-3">{statusLabel[a.status]}</td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditAuction(a);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-brand-brown hover:bg-brand-beige/50"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <Modal
        open={formOpen}
        title={editingId ? 'Editar leilão' : 'Novo leilão'}
        subtitle="Evento de oferta dos animais"
        onClose={closeAuctionForm}
      >
        <form onSubmit={saveAuctionSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Nome *</span>
            <input required className={inputClass} value={auctionForm.name} onChange={(e) => setAuctionForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Data</span>
              <input type="date" className={inputClass} value={auctionForm.auctionDate} onChange={(e) => setAuctionForm((f) => ({ ...f, auctionDate: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Status</span>
              <select className={inputClass} value={auctionForm.status} onChange={(e) => setAuctionForm((f) => ({ ...f, status: e.target.value as AuctionStatus }))}>
                {Object.entries(statusLabel).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Local</span>
              <input className={inputClass} value={auctionForm.location} onChange={(e) => setAuctionForm((f) => ({ ...f, location: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Organizador</span>
              <input className={inputClass} value={auctionForm.organizer} onChange={(e) => setAuctionForm((f) => ({ ...f, organizer: e.target.value }))} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Observações</span>
            <textarea rows={2} className={inputClass} value={auctionForm.notes} onChange={(e) => setAuctionForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Salvar leilão'}
            </button>
            <button type="button" onClick={closeAuctionForm} className="rounded-xl border border-brand-beige px-4 py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!detailId}
        title={detail?.name || 'Leilão'}
        subtitle="Lotes e arremates"
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        size="2xl"
      >
        {detailLoading || !detail ? (
          <DetailSkeleton />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-brand-olive">
              <span>
                {detail.auction_date
                  ? formatDateBR(detail.auction_date)
                  : 'Sem data'}
              </span>
              {detail.location && <span>· {detail.location}</span>}
              {canWrite && (
                <select
                  className="ml-auto rounded-lg border border-brand-beige bg-white px-2 py-1 text-xs"
                  value={detail.status}
                  onChange={(e) => changeStatus(e.target.value as AuctionStatus)}
                >
                  {Object.entries(statusLabel).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-brand-dark-brown">Lotes</h3>
              {canWrite && (
                <button
                  type="button"
                  onClick={openLotForm}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium hover:bg-brand-beige/30"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar lote
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-beige">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-brand-off-white text-brand-olive">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nº</th>
                    <th className="px-3 py-2 font-medium">Animal</th>
                    <th className="hidden px-3 py-2 font-medium sm:table-cell">Vendedor</th>
                    <th className="px-3 py-2 font-medium">Mínimo</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.lots || []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-brand-olive">
                        Nenhum lote neste leilão
                      </td>
                    </tr>
                  )}
                  {(detail.lots || []).map((lot) => (
                    <tr key={lot.id} className="border-t border-brand-beige/70">
                      <td className="px-3 py-2">{lot.lot_number || '—'}</td>
                      <td className="px-3 py-2 font-medium">{lot.animal_name}</td>
                      <td className="hidden px-3 py-2 sm:table-cell">{lot.seller_name}</td>
                      <td className="px-3 py-2">{money(lot.min_price)}</td>
                      <td className="px-3 py-2">{lotStatusLabel[lot.status] || lot.status}</td>
                      <td className="px-3 py-2 text-right">
                        {canWrite && lot.status === 'disponivel' && (
                          <button
                            type="button"
                            onClick={() => setArremateLot(lot)}
                            className="rounded-lg bg-brand-brown px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-olive"
                          >
                            Arrematar
                          </button>
                        )}
                        {lot.contract_id && (
                          <span className="text-xs text-brand-olive">Contrato #{lot.contract_id}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={lotOpen} title="Novo lote" subtitle="Animal ofertado no leilão" onClose={() => setLotOpen(false)}>
        <form onSubmit={createLotSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Animal *</span>
            <select required className={inputClass} value={lotForm.animalId} onChange={(e) => onLotAnimalChange(e.target.value)}>
              <option value="">— Selecionar —</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase text-brand-olive">Vendedor(es) do lote *</span>
              {lotForm.sellerIds.length > 0 && (
                <span className="text-xs text-brand-olive">{lotForm.sellerIds.length} selecionado(s)</span>
              )}
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-brand-beige bg-white p-2">
              {(animalOwnerIds.length
                ? [
                    ...sellers.filter((c) => animalOwnerIds.includes(c.id)),
                    ...sellers.filter((c) => !animalOwnerIds.includes(c.id)),
                  ]
                : sellers
              ).map((c) => {
                const checked = lotForm.sellerIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-off-white ${
                      checked ? 'bg-brand-beige/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleLotSeller(c.id)}
                      className="rounded border-brand-beige"
                    />
                    <span className="text-brand-dark-brown">
                      {c.name}
                      {animalOwnerIds.includes(c.id) ? (
                        <span className="text-brand-olive"> (proprietário)</span>
                      ) : null}
                      {checked && lotForm.sellerIds[0] === c.id ? (
                        <span className="text-brand-olive"> · principal</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {!sellers.length && (
                <p className="px-2 py-3 text-center text-xs text-brand-olive">Nenhum vendedor cadastrado</p>
              )}
            </div>
            <p className="text-xs text-brand-olive">
              Marque um ou mais vendedores. O primeiro marcado fica como principal no contrato (pode trocar no arremate).
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Nº do lote</span>
              <input className={inputClass} value={lotForm.lotNumber} onChange={(e) => setLotForm((f) => ({ ...f, lotNumber: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium uppercase text-brand-olive">Preço mínimo (R$)</span>
              <input type="number" min={0} step={0.01} className={inputClass} value={lotForm.minPrice} onChange={(e) => setLotForm((f) => ({ ...f, minPrice: e.target.value }))} />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Condições</span>
            <textarea rows={2} className={inputClass} value={lotForm.conditionsText} onChange={(e) => setLotForm((f) => ({ ...f, conditionsText: e.target.value }))} />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
              {saving ? 'Salvando...' : 'Adicionar lote'}
            </button>
            <button type="button" onClick={() => setLotOpen(false)} className="rounded-xl border border-brand-beige px-4 py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!arremateLot}
        title="Registrar arremate"
        subtitle={arremateLot ? `${arremateLot.animal_name} · lote ${arremateLot.lot_number || arremateLot.id}` : ''}
        onClose={() => setArremateLot(null)}
        size="2xl"
      >
        {arremateLot && (
          <ContractForm
            animalId={arremateLot.animal_id}
            sellerId={arremateLot.seller_id}
            sellerIds={
              arremateLot.sellers?.length
                ? arremateLot.sellers.map((s) => s.clientId)
                : arremateLot.seller_id
                  ? [arremateLot.seller_id]
                  : undefined
            }
            auctionId={arremateLot.auction_id}
            lotId={arremateLot.id}
            lotLabel={arremateLot.lot_number}
            suggestedAmount={arremateLot.min_price}
            onClose={() => setArremateLot(null)}
            onSaved={async () => {
              setArremateLot(null);
              await refreshDetail();
              await load();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
