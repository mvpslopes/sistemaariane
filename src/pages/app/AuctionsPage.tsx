import { useEffect, useState } from 'react';
import { Gavel, Plus } from 'lucide-react';
import {
  createAuction,
  createAuctionLot,
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
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import ContractForm from './ContractForm';

const inputClass =
  'w-full rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige';

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
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Auction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [arremateLot, setArremateLot] = useState<AuctionLot | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [sellers, setSellers] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [auctionForm, setAuctionForm] = useState({
    name: '',
    auctionDate: '',
    location: '',
    organizer: '',
    status: 'agendado' as AuctionStatus,
    notes: '',
  });
  const [lotForm, setLotForm] = useState({
    animalId: '',
    sellerId: '',
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

  const createAuctionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    try {
      const res = await createAuction({
        name: auctionForm.name,
        auctionDate: auctionForm.auctionDate || null,
        location: auctionForm.location || null,
        organizer: auctionForm.organizer || null,
        status: auctionForm.status,
        notes: auctionForm.notes || null,
      });
      success('Leilão cadastrado');
      setFormOpen(false);
      setAuctionForm({ name: '', auctionDate: '', location: '', organizer: '', status: 'agendado', notes: '' });
      await load();
      openDetail(res.id);
    } catch (err: any) {
      toastError(err.message || 'Erro ao criar leilão');
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
      setLotForm({ animalId: '', sellerId: '', lotNumber: '', minPrice: '', conditionsText: '' });
      setLotOpen(true);
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar dados do lote');
    }
  };

  const createLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite || !detailId) return;
    setSaving(true);
    try {
      await createAuctionLot({
        auctionId: detailId,
        animalId: lotForm.animalId,
        sellerId: lotForm.sellerId,
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

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          Cadastro de leilões e lotes. O leilão ao vivo fica fora do sistema — aqui você registra o evento e o arremate.
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Novo leilão
          </button>
        )}
      </div>

      {loading ? (
        <Loading message="Carregando leilões..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Leilão</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Data</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Local</th>
                <th className="px-4 py-3 font-medium">Lotes</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum leilão cadastrado
                  </td>
                </tr>
              )}
              {items.map((a) => (
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
                      ? new Date(a.auction_date + 'T12:00:00').toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="hidden px-4 py-3 lg:table-cell">{a.location || '—'}</td>
                  <td className="px-4 py-3">{a.lots_count ?? 0}</td>
                  <td className="px-4 py-3">{statusLabel[a.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} title="Novo leilão" subtitle="Evento de oferta dos animais" onClose={() => setFormOpen(false)}>
        <form onSubmit={createAuctionSubmit} className="space-y-4">
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
              {saving ? 'Salvando...' : 'Salvar leilão'}
            </button>
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-brand-beige px-4 py-2.5 text-sm">
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
          <Loading message="Carregando..." />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-brand-olive">
              <span>
                {detail.auction_date
                  ? new Date(detail.auction_date + 'T12:00:00').toLocaleDateString('pt-BR')
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
            <select required className={inputClass} value={lotForm.animalId} onChange={(e) => setLotForm((f) => ({ ...f, animalId: e.target.value }))}>
              <option value="">— Selecionar —</option>
              {animals.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase text-brand-olive">Vendedor *</span>
            <select required className={inputClass} value={lotForm.sellerId} onChange={(e) => setLotForm((f) => ({ ...f, sellerId: e.target.value }))}>
              <option value="">— Selecionar —</option>
              {sellers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
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
