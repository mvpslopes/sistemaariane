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
  Stethoscope,
  Warehouse,
  Home,
  Wallet,
} from 'lucide-react';
import {
  getDashboard,
  getClients,
  getAnimals,
  getContracts,
  getMyModules,
  mediaUrl,
  type DashboardStats,
  type Client,
  type Animal,
  type Contract,
  type MyModulesPayload,
} from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useAppMobile } from '../../hooks/useAppMobile';
import DashboardSkeleton from '../../components/skeletons/DashboardSkeleton';
import DonutChart from '../../components/DonutChart';
import DashboardHubSection from '../../components/DashboardHubSection';
import DashboardAlertsPanel from '../../components/DashboardAlertsPanel';
import ClientModulesPanel from '../../components/ClientModulesPanel';
import { clientPortalLabels } from '../../constants/clientPortalLabels';

interface RecentItem {
  id: string;
  kind: 'cliente' | 'animal' | 'contrato';
  title: string;
  subtitle: string;
  photo?: string | null;
  to: string;
  createdAt: string;
}

import { greetingBR } from '../../utils/dateTime';

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
  const { user, canWrite, canManageUsers, canUpdate, hasRole } = useAuth();
  const { error: toastError } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [myModules, setMyModules] = useState<MyModulesPayload | null>(null);
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isCliente = hasRole('cliente');
  const appMobile = useAppMobile();

  useEffect(() => {
    const loadCliente = async () => {
      const [dashRes, animalsRes, contractsRes, modRes] = await Promise.allSettled([
        getDashboard(),
        getAnimals(),
        getContracts(),
        getMyModules(),
      ]);

      if (dashRes.status === 'fulfilled') setStats(dashRes.value);
      else toastError(dashRes.reason?.message || 'Erro ao carregar resumo');

      const animalList = animalsRes.status === 'fulfilled' ? animalsRes.value : [];
      if (animalsRes.status === 'rejected') {
        toastError(animalsRes.reason?.message || 'Erro ao carregar animais');
      }

      const contractList = contractsRes.status === 'fulfilled' ? contractsRes.value : [];
      if (contractsRes.status === 'rejected') {
        toastError(contractsRes.reason?.message || 'Erro ao carregar contratos');
      }

      setAnimals(animalList);
      setContracts(contractList);
      if (modRes.status === 'fulfilled') setMyModules(modRes.value);
      setRecent(buildRecent([], animalList, contractList));
    };

    const loadAdmin = async () => {
      const [dashRes, clientsRes, animalsRes, contractsRes] = await Promise.allSettled([
        getDashboard(),
        getClients(),
        getAnimals(),
        getContracts(),
      ]);

      if (dashRes.status === 'fulfilled') setStats(dashRes.value);
      else toastError(dashRes.reason?.message || 'Erro ao carregar resumo');

      const clientList = clientsRes.status === 'fulfilled' ? clientsRes.value : [];
      const animalList = animalsRes.status === 'fulfilled' ? animalsRes.value : [];
      const contractList = contractsRes.status === 'fulfilled' ? contractsRes.value : [];

      if (clientsRes.status === 'rejected') {
        toastError(clientsRes.reason?.message || 'Erro ao carregar pessoas');
      }
      if (animalsRes.status === 'rejected') {
        toastError(animalsRes.reason?.message || 'Erro ao carregar animais');
      }
      if (contractsRes.status === 'rejected') {
        toastError(contractsRes.reason?.message || 'Erro ao carregar contratos');
      }

      setAnimals(animalList);
      setContracts(contractList);
      setRecent(buildRecent(clientList, animalList, contractList));
    };

    (isCliente ? loadCliente() : loadAdmin()).finally(() => setLoading(false));
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
      pendente_envio: 0,
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
      pendente_envio: 'Pendente envio',
      aguardando_assinatura: 'Aguardando',
      ativo: 'Ativo',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    };
    const colors: Record<string, string> = {
      rascunho: '#E6D8C3',
      pendente_envio: '#9CA3AF',
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

  if (loading) return <DashboardSkeleton mobile={appMobile} />;

  const firstName = user?.name?.split(' ')[0];
  const s = stats;

  if (appMobile) {
    return (
      <div className="dashboard-high-contrast space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-neutral-950">
            {greetingBR()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {isCliente
              ? clientPortalLabels.dashboardSubtitle
              : 'Visão geral de cadastros, contratos e cobranças'}
          </p>
        </div>

        {(s?.chargesOverdue ?? 0) > 0 && (
          <Link
            to="/app/cobrancas"
            className="block rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <span className="font-semibold">{s?.chargesOverdue} cobrança(s) atrasada(s)</span>
            <span className="mt-0.5 block text-xs text-amber-800/80">Toque para ver detalhes</span>
          </Link>
        )}

        {myModules && <ClientModulesPanel data={myModules} />}

        {!isCliente && s && (
          <>
            <DashboardHubSection stats={s} />
            <DashboardAlertsPanel stats={s} canManageSubs={canUpdate} />
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          {isCliente ? (
            <>
              <MobileStatCard
                icon={PawPrint}
                label={clientPortalLabels.purchasesLinked}
                value={s?.animals ?? 0}
                to="/app/animais"
              />
              <MobileStatCard icon={FileText} label="Contratos" value={s?.contracts ?? 0} to="/app/contratos" />
              <MobileStatCard
                icon={Banknote}
                label="Pendentes"
                value={s?.chargesPending ?? 0}
                to="/app/cobrancas"
                highlight={(s?.chargesPending ?? 0) > 0}
              />
              <MobileStatCard
                icon={Banknote}
                label="Atrasadas"
                value={s?.chargesOverdue ?? 0}
                to="/app/cobrancas"
                highlight={(s?.chargesOverdue ?? 0) > 0}
                tone="warn"
              />
            </>
          ) : (
            <>
              <MobileStatCard icon={Users} label="Pessoas" value={s?.clients ?? 0} to="/app/pessoas" />
              <MobileStatCard icon={PawPrint} label="Animais" value={s?.animals ?? 0} to="/app/animais" />
              <MobileStatCard icon={FileText} label="Contratos" value={s?.contracts ?? 0} to="/app/contratos" />
              <MobileStatCard
                icon={Banknote}
                label="Pendentes"
                value={s?.chargesPending ?? 0}
                to="/app/cobrancas"
                highlight={(s?.chargesPending ?? 0) > 0}
              />
            </>
          )}
        </div>

        {recent.length > 0 && (
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
              Atividade recente
            </h3>
            <ul className="space-y-2">
              {recent.slice(0, 5).map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    to={item.to}
                    className="flex items-center gap-3 rounded-2xl border border-brand-beige bg-white p-3 shadow-card transition active:scale-[0.99]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-brand-off-white text-xs font-semibold text-brand-brown">
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
                      <p className="truncate text-sm font-medium text-neutral-950">{item.title}</p>
                      <p className="truncate text-xs text-neutral-600">{item.subtitle}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand-olive/50" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="dashboard-high-contrast space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-950">
            {greetingBR()}
            {firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-sm text-neutral-600">
            {isCliente
              ? 'Visão geral das suas compras, contratos e cobranças'
              : 'Visão geral de cadastros, contratos e cobranças'}
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
              className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-brand-off-white"
            >
              <Plus className="h-4 w-4" /> Animal
            </Link>
            <Link
              to="/app/contratos"
              className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-brand-off-white"
            >
              <Plus className="h-4 w-4" /> Contrato
            </Link>
          </div>
        )}
      </div>

      {myModules && isCliente && <ClientModulesPanel data={myModules} />}

      {!isCliente && s && (
        <>
          <DashboardHubSection stats={s} />
          <DashboardAlertsPanel stats={s} canManageSubs={canUpdate} />
        </>
      )}

      {/* Cadastros / papéis */}
      {!isCliente && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
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
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          {isCliente ? clientPortalLabels.sectionOperation : 'Plantel e operação'}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={PawPrint}
            label={isCliente ? clientPortalLabels.purchasesLinked : 'Animais cadastrados'}
            value={s?.animals ?? 0}
            to="/app/animais"
            tone="brown"
          />
          <StatCard
            icon={PawPrint}
            label={isCliente ? clientPortalLabels.purchasesActive : 'Animais ativos'}
            value={s?.activeAnimals ?? 0}
            to="/app/animais"
            tone="forest"
          />
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

      {!isCliente && (
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
            Gestão de haras
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link
              to="/app/haras/veterinario"
              className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <Stethoscope className="h-5 w-5 text-brand-forest" />
              <p className="mt-3 text-sm font-semibold text-neutral-950">Veterinário</p>
              <p className="mt-1 text-xs text-neutral-600">Vacinas, exames e tratamentos</p>
            </Link>
            <Link
              to="/app/haras/estoque"
              className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <Warehouse className="h-5 w-5 text-brand-gold" />
              <p className="mt-3 text-sm font-semibold text-neutral-950">Estoque</p>
              <p className="mt-1 text-xs text-neutral-600">Medicamentos, ração e insumos</p>
            </Link>
            <Link
              to="/app/haras/hospedagem"
              className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <Home className="h-5 w-5 text-brand-brown" />
              <p className="mt-3 text-sm font-semibold text-neutral-950">Hospedagem</p>
              <p className="mt-1 text-xs text-neutral-600">Baias, diárias e ocupação</p>
            </Link>
            <Link
              to="/app/haras/financeiro"
              className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover"
            >
              <Wallet className="h-5 w-5 text-brand-olive" />
              <p className="mt-3 text-sm font-semibold text-neutral-950">Financeiro do haras</p>
              <p className="mt-1 text-xs text-neutral-600">Receitas e despesas da propriedade</p>
            </Link>
          </div>
        </section>
      )}

      {/* Relatórios / gráficos */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Relatórios
        </h3>
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {!isCliente && partySlices.some((p) => p.value > 0) && (
            <DonutChart title="Perfis nos cadastros" slices={partySlices} highContrast />
          )}
          <DonutChart title="Contratos por status" slices={contractSlices} highContrast />
          <DonutChart title="Cobranças" slices={chargeSlices} highContrast />
          <DonutChart
            title={isCliente ? clientPortalLabels.chartByStatus : 'Animais por status'}
            slices={statusSlices}
            highContrast
          />
          <DonutChart
            title={isCliente ? clientPortalLabels.chartBySex : 'Animais por sexo'}
            slices={sexSlices}
            highContrast
          />
          <DonutChart
            title={isCliente ? clientPortalLabels.chartByAssociation : 'Animais por associação'}
            slices={associationSlices}
            highContrast
          />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-brand-beige bg-white p-6 shadow-card lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-base font-semibold text-neutral-950">
              <Clock className="h-4 w-4 text-neutral-500" /> Atividade recente
            </h3>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">Nenhum cadastro recente.</p>
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
                    <p className="truncate text-sm font-medium text-neutral-950">{item.title}</p>
                    <p className="truncate text-xs text-neutral-600">{item.subtitle}</p>
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
                ? clientPortalLabels.summaryPurchases
                : `${s?.buyers ?? 0} compradores · ${s?.sellers ?? 0} vendedores · ${s?.assessors ?? 0} assessores · ${s?.witnesses ?? 0} testemunhas · ${s?.avalistas ?? 0} avalistas.`}
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Cadastros ✓</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Contratos ✓</span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs">Cobranças ✓</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-brand-beige/80">
            {isCliente ? (
              <>
                <Link to="/app/animais" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                  {clientPortalLabels.viewPurchases}
                </Link>
                <Link to="/app/contratos" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                  Ver contratos
                </Link>
                <Link to="/app/cobrancas" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                  Ver cobranças
                </Link>
                <Link to="/app/perfil" className="rounded-lg bg-white/5 px-3 py-2 hover:bg-white/10">
                  Meu perfil
                </Link>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
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
      to: `/app/animais/${a.id}`,
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
      <p className="text-sm text-neutral-600">{label}</p>
      <div className="mt-1 flex items-end justify-between">
        <p className="text-3xl font-semibold text-neutral-950">{value}</p>
        <ArrowRight className="h-4 w-4 text-brand-olive/0 transition group-hover:text-brand-olive/60" />
      </div>
    </Link>
  );
}

function MobileStatCard({
  icon: Icon,
  label,
  value,
  to,
  highlight = false,
  tone = 'default',
}: {
  icon: typeof Users;
  label: string;
  value: number;
  to: string;
  highlight?: boolean;
  tone?: 'default' | 'warn';
}) {
  const border =
    tone === 'warn' && highlight
      ? 'border-amber-200 bg-amber-50/50'
      : highlight
        ? 'border-brand-gold/40'
        : 'border-brand-beige';

  return (
    <Link
      to={to}
      className={`rounded-2xl border bg-white p-4 shadow-card transition active:scale-[0.98] ${border}`}
    >
      <Icon className="mb-2 h-5 w-5 text-brand-brown" />
      <p className="text-[11px] leading-tight text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
    </Link>
  );
}
