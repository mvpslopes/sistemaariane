import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  getSubscriptions,
  updateClientModules,
  type Client,
  type ClientModuleCode,
  type ClientSubscriptionPayload,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import Modal from '../../components/Modal';
import AppButton from '../../components/AppButton';
import { CLIENT_MODULES } from '../../constants/clientModules';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function buildPayload(client: Client): ClientSubscriptionPayload {
  const moduleMap = new Map((client.modules || []).map((m) => [m.code, m]));
  return {
    subscriptionType: client.subscription_type || 'assessoria',
    subscriptionSuspended: !!client.subscription_suspended,
    adhesionFee: client.adhesion_fee ?? null,
    monthlyFee: client.monthly_fee ?? null,
    adhesionPaidAt: client.adhesion_paid_at ?? null,
    modules: CLIENT_MODULES.map(({ code }) => {
      const m = moduleMap.get(code);
      return {
        code,
        active: !!m?.active,
        monthlyFee: m?.monthlyFee ?? null,
      };
    }),
  };
}

export default function SubscriptionsPage() {
  const { canUpdate } = useAuth();
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientSubscriptionPayload | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getSubscriptions());
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao carregar assinaturas');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.property_name || '').toLowerCase().includes(term) ||
        (c.document || '').includes(term)
    );
  }, [items, q]);

  const openEdit = (client: Client) => {
    setEditClient(client);
    setForm(buildPayload(client));
  };

  const toggleModule = (code: ClientModuleCode) => {
    if (!form) return;
    setForm({
      ...form,
      modules: form.modules.map((m) => (m.code === code ? { ...m, active: !m.active } : m)),
    });
  };

  const save = async () => {
    if (!editClient || !form || !canUpdate) return;
    setSaving(true);
    try {
      await updateClientModules(editClient.id, form);
      success('Assinatura atualizada');
      setEditClient(null);
      await load();
    } catch (e: unknown) {
      toastError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <ListPageSkeleton variant="table" />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-brand-olive">
        Planos e módulos por haras · adesão e mensalidade (sem gateway de pagamento nesta fase).
      </p>

      <label className="relative block max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-olive" />
        <input
          className="w-full rounded-xl border border-brand-beige bg-white py-2.5 pl-9 pr-3 text-sm"
          placeholder="Buscar haras / cliente..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>

      <div className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-brand-off-white text-brand-olive">
            <tr>
              <th className="px-4 py-3 font-medium">Cliente / Haras</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Tipo</th>
              <th className="px-4 py-3 font-medium">Módulos</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Mensalidade</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-brand-olive">
                  Nenhum cliente encontrado
                </td>
              </tr>
            )}
            {filtered.map((c) => {
              const activeMods = (c.modules || []).filter((m) => m.active).length;
              const modFees = (c.modules || [])
                .filter((m) => m.active && m.monthlyFee)
                .reduce((s, m) => s + (m.monthlyFee || 0), 0);
              const monthly = modFees || c.monthly_fee || 0;
              return (
                <tr key={c.id} className="border-t border-brand-beige/70">
                  <td className="px-4 py-3">
                    <p className="font-medium text-brand-dark-brown">{c.name}</p>
                    {c.property_name && (
                      <p className="text-xs text-brand-olive">{c.property_name}</p>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 capitalize md:table-cell">
                    {c.subscription_type || 'assessoria'}
                  </td>
                  <td className="px-4 py-3">{activeMods} ativo(s)</td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {monthly > 0 ? money(monthly) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.subscription_suspended ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        Suspensa
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Ativa
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="text-xs font-medium text-brand-brown hover:underline"
                      >
                        Gerenciar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        open={!!editClient && !!form}
        title={editClient?.name || 'Assinatura'}
        subtitle="Módulos contratados e valores"
        onClose={() => setEditClient(null)}
        size="lg"
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">Tipo</span>
                <select
                  className="w-full rounded-xl border border-brand-beige px-3 py-2"
                  value={form.subscriptionType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      subscriptionType: e.target.value as 'assessoria' | 'avulso',
                    })
                  }
                >
                  <option value="assessoria">Cliente assessoria (brinde)</option>
                  <option value="avulso">Cliente avulso (paga)</option>
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  type="checkbox"
                  checked={form.subscriptionSuspended}
                  onChange={(e) =>
                    setForm({ ...form, subscriptionSuspended: e.target.checked })
                  }
                />
                Suspender acesso por inadimplência
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">Adesão (R$)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-xl border border-brand-beige px-3 py-2"
                  value={form.adhesionFee ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      adhesionFee: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs font-medium uppercase text-brand-olive">Mensalidade base (R$)</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-full rounded-xl border border-brand-beige px-3 py-2"
                  value={form.monthlyFee ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthlyFee: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase text-brand-olive">Módulos</p>
              {CLIENT_MODULES.map(({ code, label, description }) => {
                const mod = form.modules.find((m) => m.code === code);
                return (
                  <div
                    key={code}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-beige px-3 py-2"
                  >
                    <label className="flex min-w-[10rem] flex-1 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={!!mod?.active}
                        onChange={() => toggleModule(code)}
                        className="mt-1"
                      />
                      <span>
                        <span className="font-medium text-brand-dark-brown">{label}</span>
                        <span className="block text-xs text-brand-olive">{description}</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="R$/mês"
                      className="w-28 rounded-lg border border-brand-beige px-2 py-1 text-sm"
                      value={mod?.monthlyFee ?? ''}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          modules: form.modules.map((m) =>
                            m.code === code
                              ? {
                                  ...m,
                                  monthlyFee:
                                    e.target.value === '' ? null : Number(e.target.value),
                                }
                              : m
                          ),
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 pt-2">
              <AppButton onClick={save} loading={saving}>
                Salvar
              </AppButton>
              <AppButton variant="secondary" onClick={() => setEditClient(null)}>
                Cancelar
              </AppButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
