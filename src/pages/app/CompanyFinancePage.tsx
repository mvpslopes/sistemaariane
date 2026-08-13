import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCompanyFinance, type CompanyFinanceSummary } from '../../services/apiService';
import { useToast } from '../../contexts/ToastContext';
import ListPageSkeleton from '../../components/skeletons/ListPageSkeleton';
import DonutChart from '../../components/DonutChart';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CompanyFinancePage() {
  const { error: toastError } = useToast();
  const [data, setData] = useState<CompanyFinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompanyFinance()
      .then(setData)
      .catch((e: unknown) => toastError(e instanceof Error ? e.message : 'Erro ao carregar financeiro'))
      .finally(() => setLoading(false));
  }, [toastError]);

  const revenueSlices = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Assessoria (mês)', value: data.assessoria.paidMonth, color: '#4F3E32' },
      { label: 'Comissão leilões', value: data.auctions.commissionEstimated, color: '#C08A3E' },
      { label: 'SaaS estimado', value: data.saas.monthlyEstimated, color: '#4A6650' },
    ].filter((s) => s.value > 0);
  }, [data]);

  if (loading) return <ListPageSkeleton variant="cards" />;
  if (!data) {
    return (
      <p className="py-10 text-center text-sm text-brand-olive">Não foi possível carregar o financeiro.</p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-brand-olive">
        Consolidado da assessoria · separado do financeiro por haras e por leilão.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Recebido assessoria (mês)" value={money(data.assessoria.paidMonth)} />
        <Kpi label="Recebido assessoria (ano)" value={money(data.assessoria.paidYear)} />
        <Kpi label="Em aberto" value={money(data.assessoria.open)} />
        <Kpi label="Inadimplente" value={money(data.assessoria.overdue)} tone="warn" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DonutChart title="Receitas por área (referência)" slices={revenueSlices} valueType="currency" />
        <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-brand-dark-brown">Receita assessoria — últimos 6 meses</h3>
          <ul className="space-y-2">
            {data.monthlySeries.map((m) => (
              <li key={m.label} className="flex items-center justify-between text-sm">
                <span className="text-brand-olive">{m.label}</span>
                <span className="font-semibold text-brand-dark-brown">{money(m.assessoriaPaid)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-brand-dark-brown">Leilões</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Arrematações" value={money(data.auctions.revenue)} />
            <Row label="Comissão estimada" value={money(data.auctions.commissionEstimated)} />
            <Row label="Despesas de eventos" value={money(data.auctions.expenses)} />
            <Row label="Resultado estimado" value={money(data.auctions.resultEstimated)} strong />
          </dl>
          <Link to="/app/leiloes" className="mt-3 inline-block text-xs font-medium text-brand-brown hover:underline">
            Ver leilões
          </Link>
        </section>

        <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-semibold text-brand-dark-brown">Operação e SaaS</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Repasses pendentes" value={money(data.payoutsPending)} />
            <Row label="Mensalidade SaaS estimada" value={money(data.saas.monthlyEstimated)} />
            <Row label="Haras com módulos ativos" value={String(data.saas.activeClients)} />
          </dl>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <Link to="/app/repasses" className="font-medium text-brand-brown hover:underline">
              Repasses
            </Link>
            <Link to="/app/recebiveis" className="font-medium text-brand-brown hover:underline">
              Recebíveis
            </Link>
            <Link to="/app/assinaturas" className="font-medium text-brand-brown hover:underline">
              Assinaturas
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-card ${
        tone === 'warn' ? 'border-red-200' : 'border-brand-beige'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone === 'warn' ? 'text-red-800' : 'text-brand-dark-brown'}`}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-brand-olive">{label}</dt>
      <dd className={strong ? 'font-semibold text-brand-dark-brown' : 'text-brand-dark-brown'}>{value}</dd>
    </div>
  );
}
