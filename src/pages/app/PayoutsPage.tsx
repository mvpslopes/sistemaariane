import { useEffect, useState } from 'react';
import { getPayouts, updatePayout, type Payout, type PayoutStatus } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusTone: Record<string, string> = {
  aguardando: 'bg-brand-beige/60 text-brand-olive',
  pendente: 'bg-amber-50 text-amber-800',
  pago: 'bg-emerald-50 text-emerald-700',
  cancelado: 'bg-brand-beige/60 text-brand-olive',
};

const statusLabel: Record<PayoutStatus, string> = {
  aguardando: 'Aguardando cobrança',
  pendente: 'Pendente de repasse',
  pago: 'Repassado',
  cancelado: 'Cancelado',
};

const roleLabel: Record<string, string> = {
  assessoria: 'Assessoria',
  seller: 'Vendedor',
  assessor: 'Assessor',
  outro: 'Outro',
};

export default function PayoutsPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async (st?: string) => {
    setLoading(true);
    try {
      setItems(await getPayouts(st ? { status: st } : undefined));
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar repasses');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id: string, next: PayoutStatus) => {
    if (!canWrite) return;
    setUpdatingId(id);
    try {
      await updatePayout(id, { status: next });
      success(next === 'pago' ? 'Repasse marcado como pago' : 'Status atualizado');
      await load(status || undefined);
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  const waiting = items.filter((i) => i.status === 'aguardando').length;
  const pending = items.filter((i) => i.status === 'pendente').length;
  const paid = items.filter((i) => i.status === 'pago').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{waiting}</span> aguardando cobrança ·{' '}
          <span className="font-semibold text-brand-dark-brown">{pending}</span> pendentes ·{' '}
          <span className="font-semibold text-brand-dark-brown">{paid}</span> repassados
        </p>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            load(e.target.value || undefined);
          }}
          className="rounded-xl border border-brand-beige bg-white px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="aguardando">Aguardando cobrança</option>
          <option value="pendente">Pendente de repasse</option>
          <option value="pago">Repassado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      <p className="text-xs text-brand-olive">
        Quando a cobrança do comprador é marcada como paga, o repasse correspondente fica{' '}
        <strong>pendente</strong> para você baixar (assessoria, dono e assessores).
      </p>

      {loading ? (
        <Loading message="Carregando repasses..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="px-4 py-3 font-medium">Beneficiário</th>
                <th className="px-4 py-3 font-medium">Parcela</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">%</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                    Nenhum repasse encontrado — configure % na venda/contrato
                  </td>
                </tr>
              )}
              {items.map((p) => (
                <tr key={p.id} className="border-t border-brand-beige/70">
                  <td className="px-4 py-3 font-medium text-brand-dark-brown">{p.animal_name || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{p.label || p.beneficiary_name || roleLabel[p.beneficiary_role]}</div>
                    <div className="text-xs text-brand-olive">
                      {roleLabel[p.beneficiary_role]}
                      {p.beneficiary_name ? ` · ${p.beneficiary_name}` : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    #{p.installment_no}
                    {p.charge_due_date && (
                      <div className="text-xs text-brand-olive">
                        venc. {new Date(p.charge_due_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">{p.pct}%</td>
                  <td className="px-4 py-3">{money(p.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusTone[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && p.status === 'pendente' && (
                      <button
                        type="button"
                        disabled={updatingId === p.id}
                        onClick={() => mark(p.id, 'pago')}
                        className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
                      >
                        Marcar repassado
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
