import { useEffect, useState } from 'react';
import { Plus, Search, FileText, Printer } from 'lucide-react';
import {
  getContract,
  getContracts,
  signContract,
  updateContract,
  type Contract,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import Modal from '../../components/Modal';
import ContractForm from './ContractForm';
import ContractDocument from './ContractDocument';

const statusLabel: Record<Contract['status'], string> = {
  rascunho: 'Rascunho',
  aguardando_assinatura: 'Aguardando assinatura',
  ativo: 'Ativo',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const saleLabel: Record<Contract['sale_type'], string> = {
  inteiro: 'Inteiro',
  fracao: 'Fração',
  condominio: 'Condomínio',
};

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ContractsPageProps {
  initialAnimalId?: string | null;
}

export default function ContractsPage({ initialAnimalId = null }: ContractsPageProps) {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(!!initialAnimalId);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Contract | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [signRole, setSignRole] = useState<'seller' | 'buyer' | 'assessor'>('buyer');
  const [signerName, setSignerName] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const preselectedAnimal = initialAnimalId;

  const load = async () => {
    setLoading(true);
    try {
      setItems(await getContracts(preselectedAnimal ? { animalId: preselectedAnimal } : undefined));
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar contratos');
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
    setAccepted(false);
    setSignerName('');
    try {
      setDetail(await getContract(id));
    } catch (e: any) {
      toastError(e.message || 'Erro ao abrir contrato');
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const onSign = async () => {
    if (!detailId) return;
    setSigning(true);
    try {
      const res = await signContract(detailId, {
        partyRole: signRole,
        signerName,
        accepted,
      });
      success(res.activated ? 'Assinatura registrada — contrato ativado' : 'Assinatura registrada');
      await openDetail(detailId);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao assinar');
    } finally {
      setSigning(false);
    }
  };

  const onCancel = async () => {
    if (!detailId || !canWrite) return;
    if (!confirm('Cancelar este contrato?')) return;
    try {
      await updateContract(detailId, { status: 'cancelado' });
      success('Contrato cancelado');
      await openDetail(detailId);
      await load();
    } catch (e: any) {
      toastError(e.message || 'Erro ao cancelar');
    }
  };

  const filtered = items.filter((c) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      (c.animal_name || '').toLowerCase().includes(s) ||
      (c.seller_name || '').toLowerCase().includes(s) ||
      (c.buyer_name || '').toLowerCase().includes(s)
    );
  });

  const signed = (role: string) => detail?.signatures?.some((s) => s.party_role === role);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{items.length}</span> contratos
        </p>
        {canWrite && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 hover:bg-brand-olive"
          >
            <Plus className="h-4 w-4" /> Nova venda
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrar por animal, vendedor ou comprador..."
          className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-brand-olive focus:ring-2 focus:ring-brand-beige"
        />
      </div>

      {loading ? (
        <Loading message="Carregando contratos..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Tipo</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Comprador</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum contrato encontrado
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                  <td className="px-4 py-3 font-medium text-brand-dark-brown">{c.animal_name}</td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">
                    {saleLabel[c.sale_type]}
                    {c.share_pct != null && c.sale_type !== 'inteiro' ? ` (${c.share_pct}%)` : ''}
                  </td>
                  <td className="hidden px-4 py-3 text-brand-brown lg:table-cell">{c.buyer_name}</td>
                  <td className="px-4 py-3 text-brand-brown">{money(c.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-brand-beige/60 px-2.5 py-0.5 text-xs font-medium text-brand-dark-brown">
                      {statusLabel[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(c.id)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-brand-brown hover:bg-brand-beige/50"
                    >
                      <FileText className="h-4 w-4" /> Abrir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Nova venda" subtitle="Contrato + cobranças" size="xl">
        <ContractForm
          animalId={preselectedAnimal}
          onClose={() => setFormOpen(false)}
          onSaved={(id) => {
            load();
            openDetail(id);
          }}
        />
      </Modal>

      <Modal
        open={!!detailId}
        onClose={() => {
          setDetailId(null);
          setDetail(null);
        }}
        title="Contrato de venda"
        subtitle={detail?.animal_name || ''}
        size="xl"
      >
        {detailLoading || !detail ? (
          <Loading message="Carregando contrato..." />
        ) : (
          <div className="space-y-5">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Tipo" value={`${saleLabel[detail.sale_type]}${detail.share_pct && detail.sale_type !== 'inteiro' ? ` · ${detail.share_pct}%` : ''}`} />
              <Info label="Status" value={statusLabel[detail.status]} />
              <Info label="Vendedor" value={detail.seller_name || '—'} />
              <Info label="Comprador" value={detail.buyer_name || '—'} />
              <Info label="Assessor" value={detail.assessor_name || '—'} />
              <Info label="Valor" value={money(detail.total_amount)} />
              <Info label="Pagamento" value={`${detail.payment_method.toUpperCase()} · ${detail.installments}x`} />
              <Info label="1º vencimento" value={detail.first_due_date} />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-brand-dark-brown">Assinaturas</h4>
              <ul className="space-y-1 text-sm text-brand-olive">
                <li>Vendedor: {signed('seller') ? '✓ Assinado' : 'Pendente'}</li>
                <li>Comprador: {signed('buyer') ? '✓ Assinado' : 'Pendente'}</li>
                {detail.assessor_id && (
                  <li>Assessor: {signed('assessor') ? '✓ Assinado' : 'Pendente'}</li>
                )}
              </ul>
            </div>

            {detail.status !== 'cancelado' && detail.status !== 'concluido' && (
              <div className="rounded-xl border border-brand-beige bg-brand-off-white/60 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-brand-dark-brown">Aceite digital</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    value={signRole}
                    onChange={(e) => setSignRole(e.target.value as typeof signRole)}
                    className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm"
                  >
                    <option value="seller">Como vendedor</option>
                    <option value="buyer">Como comprador</option>
                    {detail.assessor_id && <option value="assessor">Como assessor</option>}
                  </select>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Nome completo para assinatura"
                    className="rounded-xl border border-brand-beige bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <label className="flex items-start gap-2 text-sm text-brand-dark-brown/80">
                  <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1" />
                  Declaro que li e aceito os termos deste contrato de venda eletronicamente.
                </label>
                <button
                  type="button"
                  disabled={signing || !accepted || !signerName.trim()}
                  onClick={onSign}
                  className="rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-olive disabled:opacity-50"
                >
                  {signing ? 'Registrando...' : 'Assinar digitalmente'}
                </button>
              </div>
            )}

            {detail.charges && detail.charges.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-brand-dark-brown">Parcelas</h4>
                <div className="overflow-hidden rounded-xl border border-brand-beige">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-brand-off-white text-brand-olive">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Vencimento</th>
                        <th className="px-3 py-2">Valor</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.charges.map((ch) => (
                        <tr key={ch.id} className="border-t border-brand-beige/60">
                          <td className="px-3 py-2">{ch.installment_no}</td>
                          <td className="px-3 py-2">{ch.due_date}</td>
                          <td className="px-3 py-2">{money(ch.amount)}</td>
                          <td className="px-3 py-2 capitalize">{ch.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-brand-beige pt-4">
              <button
                type="button"
                onClick={() => setPrintOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-brand-beige px-4 py-2 text-sm hover:bg-brand-off-white"
              >
                <Printer className="h-4 w-4" /> Imprimir / PDF
              </button>
              {canWrite && detail.status !== 'cancelado' && (
                <button type="button" onClick={onCancel} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                  Cancelar contrato
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={printOpen && !!detail}
        onClose={() => setPrintOpen(false)}
        title="Pré-visualização do contrato"
        subtitle="Imprima ou salve em PDF com a logo da Ariane"
        size="2xl"
      >
        {detail && (
          <ContractDocument
            contract={detail}
            showActions
            onClose={() => setPrintOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-brand-olive">{label}</p>
      <p className="font-medium text-brand-dark-brown">{value}</p>
    </div>
  );
}
