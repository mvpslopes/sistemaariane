import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, PawPrint, Gavel, PieChart, Landmark } from 'lucide-react';
import type { DashboardStats } from '../services/apiService';

const money = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

interface HubCardProps {
  title: string;
  subtitle: string;
  value: string;
  hint?: string;
  to: string;
  icon: LucideIcon;
  tone: 'forest' | 'gold' | 'brown' | 'olive';
}

const toneMap = {
  forest: 'from-brand-forest/20 to-brand-forest/5 text-brand-forest border-brand-forest/20',
  gold: 'from-brand-gold/20 to-brand-gold/5 text-brand-gold border-brand-gold/25',
  brown: 'from-brand-brown/15 to-brand-brown/5 text-brand-brown border-brand-brown/20',
  olive: 'from-brand-olive/20 to-brand-olive/5 text-brand-olive border-brand-olive/20',
};

function HubCard({ title, subtitle, value, hint, to, icon: Icon, tone }: HubCardProps) {
  return (
    <Link
      to={to}
      className={`group rounded-2xl border bg-gradient-to-br p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover ${toneMap[tone]}`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="rounded-xl bg-white/70 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:opacity-60" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p>
      <p className="mt-1 text-xs text-neutral-600">{subtitle}</p>
      {hint && <p className="mt-2 text-[11px] font-medium text-neutral-700">{hint}</p>}
    </Link>
  );
}

export default function DashboardHubSection({ stats }: { stats: DashboardStats }) {
  const s = stats;
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Plataforma · 4 áreas
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HubCard
          title="Assessoria ao criador"
          subtitle="Plantel e reprodução"
          value={String(s.activeAnimals ?? 0)}
          hint={`${s.animals ?? 0} cadastrados · ${s.coveringsPending ?? 0} cobertura(s) ABCCMM pendente`}
          to="/app/animais"
          icon={PawPrint}
          tone="forest"
        />
        <HubCard
          title="Leilões"
          subtitle="Eventos e financeiro"
          value={String(s.auctionsOpen ?? 0)}
          hint="Leilões abertos ou em andamento"
          to="/app/leiloes"
          icon={Gavel}
          tone="gold"
        />
        <HubCard
          title="Recebíveis"
          subtitle="Inadimplência e aging"
          value={money(s.overdueAmount ?? 0)}
          hint={`${s.chargesOverdue ?? 0} parcela(s) atrasada(s)`}
          to="/app/recebiveis"
          icon={PieChart}
          tone="brown"
        />
        <HubCard
          title="Financeiro empresa"
          subtitle="Consolidado assessoria"
          value={money(s.assessoriaPaidMonth ?? 0)}
          hint="Recebido assessoria no mês"
          to="/app/financeiro-empresa"
          icon={Landmark}
          tone="olive"
        />
      </div>
    </section>
  );
}
