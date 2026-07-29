import { useEffect, useState } from 'react';
import { getCharges, updateCharge, type Charge, type ChargeStatus } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const statusTone: Record<string, string> = {
  pendente: 'bg-brand-beige/60 text-brand-olive',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-brand-beige/60 text-brand-olive',
};

export default function ChargesPage() {
  const { canWrite } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async (st?: string) => {
    setLoading(true);
    try {
      setItems(await getCharges(st ? { status: st } : undefined));
    } catch (e: any) {
      toastError(e.message || 'Erro ao carregar cobranças');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mark = async (id: string, next: ChargeStatus) => {
    if (!canWrite) return;
    setUpdatingId(id);
    try {
      await updateCharge(id, { status: next });
      success(next === 'pago' ? 'Cobrança marcada como paga' : 'Status atualizado');
      await load(status || undefined);
    } catch (e: any) {
      toastError(e.message || 'Erro ao atualizar');
    } finally {
      setUpdatingId(null);
    }
  };

  const pending = items.filter((i) => i.status === 'pendente' || i.status === 'atrasado').length;
  const paid = items.filter((i) => i.status === 'pago').length;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-olive">
          <span className="font-semibold text-brand-dark-brown">{pending}</span> em aberto ·{' '}
          <span className="font-semibold text-brand-dark-brown">{paid}</span> pagas
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
          <option value="pendente">Pendente</option>
          <option value="atrasado">Atrasado</option>
          <option value="pago">Pago</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {loading ? (
        <Loading message="Carregando cobranças..." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-brand-off-white text-brand-olive">
              <tr>
                <th className="px-4 py-3 font-medium">Animal</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Cliente</th>
                <th className="px-4 py-3 font-medium">Parcela</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-brand-olive">
                    Nenhuma cobrança encontrada
                  </td>
                </tr>
              )}
              {items.map((c) => (
                <tr key={c.id} className="border-t border-brand-beige/60 hover:bg-brand-off-white/70">
                  <td className="px-4 py-3 font-medium text-brand-dark-brown">{c.animal_name}</td>
                  <td className="hidden px-4 py-3 text-brand-brown md:table-cell">{c.client_name}</td>
                  <td className="px-4 py-3 text-brand-brown">
                    {c.installment_no} · {c.payment_method.toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-brand-brown">{c.due_date}</td>
                  <td className="px-4 py-3 text-brand-brown">{money(c.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusTone[c.status] || statusTone.pendente}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canWrite && c.status !== 'pago' && c.status !== 'cancelado' && (
                      <button
                        type="button"
                        disabled={updatingId === c.id}
                        onClick={() => mark(c.id, 'pago')}
                        className="rounded-lg px-2 py-1 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        Marcar pago
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
