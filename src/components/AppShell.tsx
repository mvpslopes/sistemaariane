import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  UserCog,
  FileText,
  Banknote,
  PanelLeftClose,
  PanelLeftOpen,
  Gavel,
  Split,
  FileStack,
  Menu,
  X,
  Shield,
  PieChart,
  Landmark,
  Package,
  Dna,
  Wallet,
  Settings,
  ClipboardList,
  FileBarChart,
  MessageCircle,
  Crown,
  Briefcase,
  Warehouse,
  Home,
  Stethoscope,
} from 'lucide-react';
import {
  NavAccordion,
  NavSectionLabel,
  NavSubLink,
  NavTopLink,
  sectionIsActive,
} from './SidebarNav';
import { useAuth } from '../contexts/AuthContext';
import AppBottomNav from './AppBottomNav';
import HeaderUserMenu from './HeaderUserMenu';
import MobileMoreSheet from './MobileMoreSheet';
import { clientPortalLabels, resolvePageMeta } from '../constants/clientPortalLabels';
import HeaderDateTime from './HeaderDateTime';
import NotificationBell from './NotificationBell';
import SupportMenu from './SupportMenu';
import { AiAssistantProvider, useAiAssistant } from '../contexts/AiAssistantContext';
import AiAssistantFab from './AiAssistantFab';
import AssistantSidebarButton from './AssistantSidebarButton';
import ChatSidebarLink from './ChatSidebarLink';
import { useChatMessageNotifications } from '../hooks/useChatMessageNotifications';
import { usePresenceHeartbeat } from '../hooks/usePresenceHeartbeat';
import { useIsMobile } from '../hooks/useIsMobile';
import { useOperationalAlerts } from '../hooks/useOperationalAlerts';
import { useClienteHarasLinks } from '../hooks/useClienteHarasLinks';
import { AI_ASSISTANT_ENABLED } from '../constants/featureFlags';
import PageTransition from './PageTransition';
import PwaInstallBanner from './PwaInstallBanner';
import AppBrandMark from './AppBrandMark';
import ThemeIconButton from './ThemeIconButton';

const assessoriaPaths = [
  '/app/pessoas',
  '/app/animais',
  '/app/relatorio-plantel',
  '/app/reproducao',
  '/app/haras',
  '/app/contratos',
  '/app/modelos-contrato',
  '/app/registro-diario',
  '/app/repasses',
];
const cobrancasPaths = [
  '/app/cobrancas',
  '/app/recebiveis',
  '/app/relatorio-cobranca',
  '/app/financeiro-empresa',
];
const sistemaPaths = ['/app/usuarios', '/app/auditoria', '/app/assinaturas'];

function AppShellInner() {
  const { user, logout, canManageUsers, canViewAudit, canUpdate, hasRole } = useAuth();
  const navigate = useNavigate();
  const { openAssistant } = useAiAssistant();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  const [assessoriaOpen, setAssessoriaOpen] = useState(true);
  const [cobrancasOpen, setCobrancasOpen] = useState(false);
  const [sistemaOpen, setSistemaOpen] = useState(false);
  const isCliente = hasRole('cliente');
  const isRoot = hasRole('root');
  const isAssessor = !!user?.isAssessor && isCliente;
  const clienteHarasLinks = useClienteHarasLinks();
  const pathname = location.pathname;
  const { stats: alertStats, loading: alertsLoading } = useOperationalAlerts(!!user);
  useChatMessageNotifications(!!user);
  usePresenceHeartbeat(!!user);

  const compact = !isMobile && collapsed;

  useEffect(() => {
    if (!AI_ASSISTANT_ENABLED) return;
    const params = new URLSearchParams(location.search);
    if (params.get('assistente') === '1') {
      openAssistant();
      params.delete('assistente');
      const qs = params.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, openAssistant]);

  useEffect(() => {
    if (sectionIsActive(assessoriaPaths, pathname)) {
      setAssessoriaOpen(true);
      setCobrancasOpen(false);
      setSistemaOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(cobrancasPaths, pathname)) {
      setCobrancasOpen(true);
      setAssessoriaOpen(false);
      setSistemaOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(sistemaPaths, pathname)) setSistemaOpen(true);
  }, [pathname]);

  useEffect(() => {
    setMobileOpen(false);
    setMoreOpen(false);
    document.body.style.overflow = '';
  }, [location.pathname]);

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
      document.body.style.overflow = moreOpen ? 'hidden' : '';
      return () => {
        document.body.style.overflow = '';
      };
    }
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen, isMobile, moreOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const meta = resolvePageMeta(location.pathname, isCliente, isAssessor);

  const showSistemaSection = canManageUsers || canViewAudit || canUpdate;

  if (isMobile) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-brand-off-white text-brand-dark-brown">
        <header className="sticky top-0 z-20 shrink-0 border-b border-brand-beige/70 bg-white/95 px-4 py-3 backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand-gold">
                {isAssessor ? 'Portal assessor' : isCliente ? 'Portal cliente' : 'Gestão de Haras'}
              </p>
              <h1 className="truncate text-base font-semibold text-brand-dark-brown">{meta.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <NotificationBell
                userId={user?.id}
                stats={alertStats}
                canManageSubs={canUpdate}
                loading={alertsLoading}
                compact
              />
              <HeaderUserMenu
                name={user?.name}
                role={user?.role}
                avatarUrl={user?.avatarUrl}
                onLogout={handleLogout}
                compact
              />
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-36">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <AppBottomNav onMore={() => setMoreOpen(true)} />
        <PwaInstallBanner />
        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onLogout={handleLogout}
          onOpenAssistant={
            AI_ASSISTANT_ENABLED
              ? () => {
                  setMoreOpen(false);
                  openAssistant();
                }
              : undefined
          }
        />
        {AI_ASSISTANT_ENABLED && <AiAssistantFab />}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-off-white text-brand-dark-brown">
      <div
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity duration-300 md:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />

      <aside
        className={`theme-fixed fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,86vw)] flex-col bg-gradient-to-b from-brand-dark-brown to-[#3d2f26] text-white shadow-2xl transition-transform duration-300 ease-out md:static md:z-auto md:shadow-none md:transition-[width] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${compact ? 'md:w-[76px]' : 'md:w-64'} md:shrink-0`}
      >
        <div
          className={`border-b border-white/10 pb-3 ${compact ? 'px-2 pt-3 md:px-2' : 'px-3 pt-3'}`}
        >
          <div
            className={`relative flex items-start gap-2 ${compact ? 'md:flex-col md:items-center' : ''}`}
          >
            <AppBrandMark compact={compact} />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-0 top-0 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-brand-beige/80 hover:bg-white/10 hover:text-white md:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <nav className="scrollbar-sidebar flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 pt-2">
          <NavTopLink to="/app" end icon={LayoutDashboard} label="Início" compact={compact} />
          <ChatSidebarLink compact={compact} />
          {isRoot && (
            <NavTopLink to="/app/root" icon={Crown} label="Root" compact={compact} />
          )}

          {!isCliente && (
            <>
              <NavSectionLabel compact={compact}>Módulos</NavSectionLabel>
              <NavAccordion
                label="Assessoria"
                icon={Briefcase}
                paths={assessoriaPaths}
                open={assessoriaOpen}
                onToggle={() => {
                  setAssessoriaOpen((v) => !v);
                  if (!assessoriaOpen) {
                    setCobrancasOpen(false);
                    setSistemaOpen(false);
                  }
                }}
                compact={compact}
              >
                <NavSubLink to="/app/pessoas" icon={Users} label="Pessoas" compact={compact} />
                <NavSubLink to="/app/animais" icon={PawPrint} label="Animais" compact={compact} />
                <NavSubLink to="/app/relatorio-plantel" icon={FileBarChart} label="Relatório do plantel" compact={compact} />
                <NavSubLink to="/app/reproducao" icon={Dna} label="Reprodução" compact={compact} />
                {!compact && (
                  <NavSectionLabel compact={compact}>Plantel / Haras</NavSectionLabel>
                )}
                <NavSubLink to="/app/haras/veterinario" icon={Stethoscope} label="Controle veterinário" compact={compact} />
                <NavSubLink to="/app/haras/estoque" icon={Warehouse} label="Controle de estoque" compact={compact} />
                <NavSubLink to="/app/haras/hospedagem" icon={Home} label="Controle de hospedagem" compact={compact} />
                <NavSubLink to="/app/haras/financeiro" icon={Wallet} label="Controle financeiro" compact={compact} />
                <NavSubLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
                <NavSubLink to="/app/modelos-contrato" icon={FileStack} label="Modelos" compact={compact} />
                <NavSubLink to="/app/registro-diario" icon={ClipboardList} label="Registro diário" compact={compact} />
                <NavSubLink to="/app/repasses" icon={Split} label="Repasses" compact={compact} />
              </NavAccordion>

              <NavTopLink to="/app/leiloes" icon={Gavel} label="Leilões" compact={compact} />

              <NavAccordion
                label="Cobranças"
                icon={Banknote}
                paths={cobrancasPaths}
                open={cobrancasOpen}
                onToggle={() => {
                  setCobrancasOpen((v) => !v);
                  if (!cobrancasOpen) {
                    setAssessoriaOpen(false);
                    setSistemaOpen(false);
                  }
                }}
                compact={compact}
              >
                <NavSubLink to="/app/cobrancas" icon={Banknote} label="Parcelas" compact={compact} />
                <NavSubLink to="/app/recebiveis" end icon={PieChart} label="Recebíveis" compact={compact} />
                <NavSubLink
                  to="/app/relatorio-cobranca"
                  icon={MessageCircle}
                  label="Relatório"
                  compact={compact}
                />
                <NavSubLink
                  to="/app/financeiro-empresa"
                  icon={Landmark}
                  label="Financeiro"
                  compact={compact}
                />
              </NavAccordion>

              {showSistemaSection && (
                <NavAccordion
                  label="Sistema"
                  icon={Settings}
                  paths={sistemaPaths}
                  open={sistemaOpen}
                  onToggle={() => {
                    setSistemaOpen((v) => !v);
                    if (!sistemaOpen) {
                      setAssessoriaOpen(false);
                      setCobrancasOpen(false);
                    }
                  }}
                  compact={compact}
                >
                  {canManageUsers && (
                    <NavSubLink to="/app/usuarios" icon={UserCog} label="Usuários" compact={compact} />
                  )}
                  {canViewAudit && (
                    <NavSubLink to="/app/auditoria" icon={Shield} label="Auditoria" compact={compact} />
                  )}
                  {canUpdate && (
                    <NavSubLink to="/app/assinaturas" icon={Package} label="Assinaturas" compact={compact} />
                  )}
                </NavAccordion>
              )}
            </>
          )}

          {isCliente && !isAssessor && (
            <>
              <NavSectionLabel compact={compact}>Minhas compras</NavSectionLabel>
              <NavTopLink
                to="/app/animais"
                icon={PawPrint}
                label={clientPortalLabels.animalsNav}
                compact={compact}
              />
              <NavTopLink
                to="/app/relatorio-plantel"
                icon={FileBarChart}
                label="Relatório do plantel"
                compact={compact}
              />
              <NavTopLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
              <NavTopLink to="/app/cobrancas" icon={Banknote} label="Cobranças" compact={compact} />
              {clienteHarasLinks.length > 0 && (
                <>
                  <NavSectionLabel compact={compact}>Meu haras</NavSectionLabel>
                  {clienteHarasLinks.map((l) => (
                    <NavTopLink
                      key={l.to}
                      to={l.to}
                      icon={
                        l.code === 'sanitario'
                          ? Stethoscope
                          : l.code === 'estoque'
                            ? Warehouse
                            : l.code === 'hospedagem'
                              ? Home
                              : Wallet
                      }
                      label={l.label}
                      compact={compact}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {isAssessor && (
            <>
              <NavSectionLabel compact={compact}>Operação</NavSectionLabel>
              <NavTopLink to="/app/leiloes" icon={Gavel} label="Leilões" compact={compact} />
              <NavTopLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
              <NavTopLink to="/app/repasses" icon={Split} label="Repasses" compact={compact} />
            </>
          )}

          {AI_ASSISTANT_ENABLED && <AssistantSidebarButton compact={compact} />}
        </nav>

        <div className="hidden border-t border-white/10 p-2 md:block">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-brand-beige/60 transition hover:bg-white/5 hover:text-white ${
              compact ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <PanelLeftClose className="h-4 w-4 shrink-0" />
            )}
            {!compact && <span>{collapsed ? 'Expandir' : 'Recolher'}</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-brand-beige/70 bg-white/90 px-3 py-3 backdrop-blur-md sm:gap-4 sm:px-4 md:px-6 md:py-4">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown hover:bg-brand-off-white md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-brand-dark-brown sm:text-lg">
                {meta.title}
              </h1>
              <p className="hidden truncate text-xs text-brand-olive sm:block">{meta.subtitle}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <SupportMenu userName={user?.name} compact />
            <NotificationBell
              userId={user?.id}
              stats={alertStats}
              canManageSubs={canUpdate}
              loading={alertsLoading}
            />
            <HeaderDateTime className="hidden xl:block" />
            <ThemeIconButton className="hidden md:inline-flex" />
            <span className="mx-0.5 hidden h-6 w-px bg-brand-beige md:block" aria-hidden />
            <HeaderUserMenu
              name={user?.name}
              role={user?.role}
              avatarUrl={user?.avatarUrl}
              onLogout={handleLogout}
            />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      {AI_ASSISTANT_ENABLED && <AiAssistantFab />}
    </div>
  );
}

export default function AppShell() {
  return (
    <AiAssistantProvider>
      <AppShellInner />
    </AiAssistantProvider>
  );
}
