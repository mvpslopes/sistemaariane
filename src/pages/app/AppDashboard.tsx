import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  PawPrint,
  UserCog,
  Plus,
  ArrowRight,
  Clock,
  ShoppingBag,
  Store,
  Briefcase,
  FileText,
  Banknote,
} from 'lucide-react';
import {
  getDashboard,
  getClients,
  getAnimals,
  getContracts,
  mediaUrl,
  type DashboardStats,
  type Client,
  type Animal,
  type Contract,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Loading from '../../components/Loading';
import DonutChart from '../../components/DonutChart';

interface RecentItem {
  id: string;
  kind: 'cliente' | 'animal' | 'contrato';
  title: string;
  subtitle: string;
  photo?: string | null;
  to: string;
  createdAt: string;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const STATUS_COLORS: Record<Animal['status'], string> = {
  ativo: '#4A6650',
  vendido: '#C08A3E',
  falecido: '#81705F',
  transferido: '#A0896A',
};

const STATUS_LABELS: Record<Animal['status'], string> = {
  ativo: 'Ativo',
  vendido: 'Vendido',
  falecido: 'Falecido',
  transferido: 'Transferido',
};

const ASSOC_COLORS: Record<Animal['association'], string> = {
  ABCCMM: '#4F3E32',
  ABQM: '#C08A3E',
  OUTRA: '#81705F',
  NENHUMA: '#A0896A',
};

const ASSOC_LABELS: Record<Animal['association'], string> = {
  ABCCMM: 'ABCCMM',
  ABQM: 'ABQM',
  OUTRA: 'Outra',
  NENHUMA: 'Nenhuma',
};

export default function AppDashboard() {
  const { user, canWrite, canManageUsers, hasRole } = useAuth();
  const { error: toastError } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isCliente = hasRole('cliente');

  useEffect(() => {
    const load = isCliente
      ? Promise.all([getDashboard(), getAnimals(), getContracts()]).then(
          ([dash, animalList, contractList]) => {
            setStats(dash);
            setAnimals(animalList);
            setContracts(contractList);
            setRecent(buildRecent([], animalList, contractList));
          }
        )
      : Promise.all([getDashboard(), getClients(), getAnimals(), getContracts()]).then(
          ([dash, clientList, animalList, contractList]) => {
            setStats(dash);
            setAnimals(animalList);
            setContracts(contractList);
            setRecent(buildRecent(clientList, animalList, contractList));
          }
        );

    load
      .catch((e) => toastError(e.message || 'Erro ao carregar dashboard'))
      .finally(() => setLoading(false));
  }, [toastError, isCliente]);

  const statusSlices = useMemo(() => {
    const counts: Record<Animal['status'], number> = {
      ativo: 0,
      vendido: 0,
      falecido: 0,
      transferido: 0,
    };
    animals.forEach((a) => {
      if (counts[a.status] !== undefined) counts[a.status] += 1;
    });
    return (Object.keys(counts) as Animal['status'][]).map((key) => ({
      label: STATUS_LABELS[key],
      value: counts[key],
      color: STATUS_COLORS[key],
    }));
  }, [animals]);

  const sexSlices = useMemo(() => {
    let m = 0;
    let f = 0;
    let c = 0;
    let u = 0;
    animals.forEach((a) => {
      if (a.sex === 'M') m += 1;
      else if (a.sex === 'F') f += 1;
      else if (a.sex === 'C') c += 1;
      else u += 1;
    });
    return [
      { label: 'Macho', value: m, color: '#4F3E32' },
      { label: 'Fêmea', value: f, color: '#C08A3E' },
      { label: 'Castrado', value: c, color: '#8A9A5B' },
      { label: 'Não informado', value: u, color: '#E6D8C3' },
    ].filter((s) => s.value > 0 || animals.length === 0);
  }, [animals]);

  const associationSlices = useMemo(() => {
    const counts: Record<Animal['association'], number> = {
      ABCCMM: 0,
      ABQM: 0,
      OUTRA: 0,
      NENHUMA: 0,
    };
    animals.forEach((a) => {
      if (counts[a.association] !== undefined) counts[a.association] += 1;
      else counts.NENHUMA += 1;
    });
    return (Object.keys(counts) as Animal['association'][])
      .map((key) => ({
        label: ASSOC_LABELS[key],
        value: counts[key],
        color: ASSOC_COLORS[key],
      }))
      .filter((s) => s.value > 0 || animals.length === 0);
  }, [animals]);

  const partySlices = useMemo(() => {
    if (isCliente) return [];
    return [
      { label: 'Compradores', value: stats?.buyers ?? 0, color: '#C08A3E' },
      { label: 'Vendedores', value: stats?.sellers ?? 0, color: '#4F3E32' },
      { label: 'Assessores', value: stats?.assessors ?? 0, color: '#4A6650' },
      { label: 'Testemunhas', value: stats?.witnesses ?? 0, color: '#81705F' },
      { label: 'Avalistas', value: stats?.avalistas ?? 0, color: '#6B5B4A' },
    ];
  }, [stats, isCliente]);

  const contractSlices = useMemo(() => {
    const counts: Record<string, number> = {
      rascunho: 0,
      aguardando_assinatura: 0,
      ativo: 0,
      concluido: 0,
      cancelado: 0,
    };
    contracts.forEach((c) => {
      if (counts[c.status] !== undefined) counts[c.status] += 1;
    });
    const labels: Record<string, string> = {
      rascunho: 'Rascunho',
      aguardando_assinatura: 'Aguardando',
      ativo: 'Ativo',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    };
    const colors: Record<string, string> = {
      rascunho: '#E6D8C3',
      aguardando_assinatura: '#C08A3E',
      ativo: '#4A6650',
      concluido: '#4F3E32',
      cancelado: '#81705F',
    };
    return Object.keys(counts).map((key) => ({
      label: labels[key],
      value: counts[key],
      color: colors[key],
    }));
  }, [contracts]);

  const chargeSlices = useMemo(() => {
    return [
      { label: 'Pendentes', value: stats?.chargesPending ?? 0, color: '#C08A3E' },
      { label: 'Atrasadas', value: stats?.chargesOverdue ?? 0, color: '#B45309' },
      { label: 'Pagas', value: stats?.chargesPaid ?? 0, color: '#4A6650' },
    ];
  }, [stats]);

  if (loading) return <Loading message="Carregando painel..." />;

  const firstName = user?.name?.split(' ')[0];
  const s = stats;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-brand-dark-brown">
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-brand-olive">
            Visão geral de cadastros, contratos e cobranças
          </p>
        </div>
        {canWrite && !isCliente && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/app/pessoas"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-brown px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand-brown/20 transition hover:bg-brand-olive"
            >
              <Plus className="h-4 w-4" /> Pessoa
            </Link>
            <Link
              to="/app/animais"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-brand-dark-brown/80 transition hover:bg-brand-off-white"
            >
              <Plus className="h-4 w-4" /> Animal
            </Link>
            <Link
              to="/app/contratos"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-brand-dark-brown/80 transition hover:bg-brand-off-white"
            >
              <Plus className="h-4 w-4" /> Contrato
            </Link>
          </div>
        )}
      </div>

      {/* Cadastros / papéis */}
      {!isCliente && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-olive/70">
            Cadastros
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Pessoas ativas" value={s?.clients ?? 0} to="/app/pessoas" tone="olive" />
            <StatCard icon={ShoppingBag} label="Compradores" value={s?.buyers ?? 0} to="/app/pessoas" tone="gold" />
            <StatCard icon={Store} label="Vendedores" value={s?.sellers ?? 0} to="/app/pessoas" tone="brown" />
            <StatCard icon={Briefcase} label="Assessores" value={s?.assessors ?? 0} to="/app/pessoas" tone="forest" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Users} label="Testemunhas" value={s?.witnesses ?? 0} to="/app/pessoas" tone="olive" />
          </div>
        </section>
      )}

      {/* Operação */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-olive/70">
          Plantel e operação
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={PawPrint} label="Animais cadastrados" value={s?.animals ?? 0} to="/app/animais" tone="brown" />
          <StatCard icon={PawPrint} label="Animais ativos" value={s?.activeAnimals ?? 0} to="/app/animais" tone="forest" />
          <StatCard icon={FileText} label="Contratos" value={s?.contracts ?? 0} to="/app/contratos" tone="gold" />
          <StatCard
            icon={Banknote}
            label="Cobranças pendentes"
            value={s?.chargesPending ?? 0}
            to="/app/cobrancas"
            tone="olive"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FileText}
            label="Contratos ativos"
            value={s?.contractsActive ?? 0}
            to="/app/contratos"
            tone="forest"
          />
          <StatCard
            icon={FileText}
            label="Aguardando assinatura"
            value={s?.contractsAwaiting ?? 0}
            to="/app/contratos"
            tone="gold"
          />
          <StatCard
            icon={Banknote}
            label="Cobranças atrasadas"
            value={s?.chargesOverdue ?? 0}
            to="/app/cobrancas"
            tone="brown"
          />
          <StatCard
            icon={Banknote}
            label="Cobranças pagas"
            value={s?.chargesPaid ?? 0}
            to="/app/cobrancas"
            tone="forest"
          />
        </div>
        {canManageUsers && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={UserCog} label="Usuários" value={s?.users ?? 0} to="/app/usuarios" tone="olive" />
          </div>
        )}
      </section>

      {/* Relatórios / gráficos */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-olive/70">
          Relatórios
        </h3>
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!isCliente && partySlices.some((p) => p.value > 0) && (
            <DonutChart title="Perfis nos cadastros" slices={partySlices} />
          )}
          <DonutChart title="Contratos por status" slices={contractSlices} />
          <DonutChart title="Cobranças" slices={chargeSlices} />
          <DonutChart title="Animais por status" slices={statusSlices} />
          <DonutChart title="Animais por sexo" slices={sexSlices} />
          <DonutChart title="Animais por associação" slices={associationSlices} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-brand-beige bg-white p-6 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-brand-dark-brown">
              <Clock className="h-4 w-4 text-brand-olive" /> Atividade recente
            </h3>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-brand-olive">Nenhum cadastro recente.</p>
          ) : (
            <ul className="divide-y divide-brand-beige/60">
              {recent.map((item) => (
                <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-off-white text-xs font-semibold text-brand-brown">
                    {item.photo ? (
                      <img
                        src={mediaUrl(item.photo) || undefined}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      item.title.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-brand-dark-brown">{item.title}</p>
                    <p className="truncate text-xs text-brand-olive">{item.subtitle}</p>
                  </div>
                  <Link
                    to={item.to}
                    className="shrink-0 rounded-lg p-1.5 text-brand-olive/60 hover:bg-brand-off-white hover:text-brand-brown"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-brand-beige bg-gradient-to-br from-brand-dark-brown to-[#3d2f26] p-6 text-white shadow-card lg:col-span-2">
          <div>
            <h3 className="text-lg font-semibold">Resumo operacional</h3>
            <p className="mt-2 text-sm text-brand-beige/70">
              {isCliente
                ? 'Acompanhe seus animais, contratos e cobranças vinculadas.'
                : `${s?.buyers ?? 0} compradores · ${s?.sellers ?? 0} vendedores · ${s?.assessors ?? 0} assessores · ${s?.witnesses ?? 0} testemunhas · ${s?.avalistas ?? 0} avalistas.`}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Cadastros ✓</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Contratos ✓</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Cobranças ✓</span>
          </div>
          {!isCliente && (
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-brand-beige/80">
              <Link to="/app/pessoas" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                Ver pessoas
              </Link>
              <Link to="/app/contratos" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                Ver contratos
              </Link>
              <Link to="/app/animais" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                Ver animais
              </Link>
              <Link to="/app/cobrancas" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                Ver cobranças
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildRecent(
  clients: Client[],
  animals: Animal[],
  contracts: Contract[]
): RecentItem[] {
  const clientItems: RecentItem[] = clients
    .filter((c) => c.created_at)
    .map((c) => {
      const roles = [
        c.is_buyer ? 'Comprador' : null,
        c.is_seller ? 'Vendedor' : null,
        c.is_assessor ? 'Assessor' : null,
        c.is_witness ? 'Testemunha' : null,
        c.is_avalista ? 'Avalista' : null,
      ].filter(Boolean);
      const to = '/app/pessoas';
      return {
        id: c.id,
        kind: 'cliente' as const,
        title: c.name,
        subtitle: roles.length
          ? roles.join(' · ')
          : [c.city, c.state].filter(Boolean).join('/') || 'Pessoa',
        to,
        createdAt: c.created_at!,
      };
    });

  const animalItems: RecentItem[] = animals
    .filter((a) => a.created_at)
    .map((a) => ({
      id: a.id,
      kind: 'animal' as const,
      title: a.name,
      subtitle: a.breed || 'Animal',
      photo: a.photo_url,
      to: '/app/animais',
      createdAt: a.created_at!,
    }));

  const contractItems: RecentItem[] = contracts
    .filter((c) => c.created_at)
    .map((c) => ({
      id: c.id,
      kind: 'contrato' as const,
      title: `Contrato · ${c.animal_name || 'Animal'}`,
      subtitle: `${c.seller_name || 'Vendedor'} → ${c.buyer_name || 'Comprador'}`,
      to: '/app/contratos',
      createdAt: c.created_at!,
    }));

  return [...clientItems, ...animalItems, ...contractItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
}

const tones = {
  gold: 'from-brand-gold/15 to-brand-gold/5 text-brand-gold',
  brown: 'from-brand-brown/15 to-brand-brown/5 text-brand-brown',
  forest: 'from-brand-forest/15 to-brand-forest/5 text-brand-forest',
  olive: 'from-brand-olive/20 to-brand-olive/5 text-brand-olive',
};

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  to: string;
  tone: keyof typeof tones;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-brand-beige bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-olive/40 hover:shadow-card-hover"
    >
      <div
        className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-brand-olive">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-3xl font-semibold text-brand-dark-brown">{value}</p>
        <ArrowRight className="h-4 w-4 text-brand-olive/0 transition group-hover:text-brand-olive/60" />
      </div>
    </Link>
  );
}
