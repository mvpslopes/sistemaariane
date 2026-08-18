import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  UserCog,
  LogOut,
  KeyRound,
  FileText,
  Banknote,
  FolderOpen,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Gavel,
  Split,
  FileStack,
  Menu,
  X,
  Shield,
  MoreHorizontal,
  PieChart,
  Landmark,
  Package,
  Dna,
  Wallet,
  Settings,
  ClipboardList,
  MessageCircle,
  Crown,
} from 'lucide-react';
import {
  NavAccordion,
  NavSectionLabel,
  NavSubLink,
  NavTopLink,
  sectionIsActive,
} from './SidebarNav';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';
import AppBottomNav from './AppBottomNav';
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
import PageTransition from './PageTransition';
import PwaInstallBanner from './PwaInstallBanner';
import AppBrandMark from './AppBrandMark';
import ThemeIconButton from './ThemeIconButton';

const roleLabel: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Operador',
  cliente: 'Cliente',
};

const cadastroPaths = ['/app/pessoas', '/app/animais', '/app/reproducao'];
const operacaoPaths = ['/app/leiloes', '/app/contratos', '/app/modelos-contrato', '/app/registro-diario'];
const financeiroPaths = [
  '/app/cobrancas',
  '/app/recebiveis',
  '/app/relatorio-cobranca',
  '/app/financeiro-empresa',
  '/app/repasses',
  '/app/assinaturas',
];
const sistemaPaths = ['/app/usuarios', '/app/auditoria'];
const contaPaths = ['/app/perfil', '/app/alterar-senha'];

function AppShellInner() {
  const { user, logout, canManageUsers, canViewAudit, canUpdate, hasRole } = useAuth();
  const navigate = useNavigate();
  const { openAssistant } = useAiAssistant();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const isMobile = useIsMobile();
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [operacaoOpen, setOperacaoOpen] = useState(true);
  const [financeiroOpen, setFinanceiroOpen] = useState(true);
  const [sistemaOpen, setSistemaOpen] = useState(false);
  const [contaOpen, setContaOpen] = useState(false);
  const isCliente = hasRole('cliente');
  const isRoot = hasRole('root');
  const isAssessor = !!user?.isAssessor && isCliente;
  const pathname = location.pathname;
  const { stats: alertStats, loading: alertsLoading } = useOperationalAlerts(!!user);
  useChatMessageNotifications(!!user);
  usePresenceHeartbeat(!!user);

  const compact = !isMobile && collapsed;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('assistente') === '1') {
      openAssistant();
      params.delete('assistente');
      const qs = params.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
    }
  }, [location.pathname, location.search, navigate, openAssistant]);

  useEffect(() => {
    if (sectionIsActive(cadastroPaths, pathname)) setCadastrosOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(operacaoPaths, pathname)) setOperacaoOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(financeiroPaths, pathname)) setFinanceiroOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(sistemaPaths, pathname)) setSistemaOpen(true);
  }, [pathname]);

  useEffect(() => {
    if (sectionIsActive(contaPaths, pathname)) setContaOpen(true);
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

  const showSistemaSection = canManageUsers || canViewAudit;

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
              <ThemeIconButton />
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown transition hover:bg-brand-off-white"
                title="Mais opções"
                aria-label="Mais opções"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
              <Link
                to="/app/perfil"
                className="shrink-0 rounded-full ring-2 ring-brand-beige/60 transition hover:ring-brand-olive/40"
                title="Meu perfil"
              >
                <UserAvatar name={user?.name || 'U'} avatarUrl={user?.avatarUrl} size="md" />
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-36">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <AppBottomNav />
        <PwaInstallBanner />
        <MobileMoreSheet
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          onLogout={handleLogout}
          onOpenAssistant={() => {
            setMoreOpen(false);
            openAssistant();
          }}
        />
        <AiAssistantFab />
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

        <nav className="scrollbar-sidebar flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pb-2 pt-1">
          <NavSectionLabel compact={compact}>Principal</NavSectionLabel>
          <NavTopLink to="/app" end icon={LayoutDashboard} label="Dashboard" compact={compact} />
          {isRoot && (
            <NavTopLink to="/app/root" icon={Crown} label="Root" compact={compact} />
          )}
          <ChatSidebarLink compact={compact} />

          {/* ——— Staff ——— */}
          {!isCliente && (
            <>
              <NavAccordion
                label="Cadastros"
                icon={FolderOpen}
                paths={cadastroPaths}
                open={cadastrosOpen}
                onToggle={() => setCadastrosOpen((v) => !v)}
                compact={compact}
              >
                <NavSubLink to="/app/pessoas" icon={Users} label="Pessoas" compact={compact} />
                <NavSubLink to="/app/animais" icon={PawPrint} label="Animais" compact={compact} />
                <NavSubLink to="/app/reproducao" icon={Dna} label="Reprodução" compact={compact} />
              </NavAccordion>

              <NavAccordion
                label="Operação"
                icon={Gavel}
                paths={operacaoPaths}
                open={operacaoOpen}
                onToggle={() => setOperacaoOpen((v) => !v)}
                compact={compact}
              >
                <NavSubLink to="/app/leiloes" icon={Gavel} label="Leilões" compact={compact} />
                <NavSubLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
                <NavSubLink to="/app/modelos-contrato" icon={FileStack} label="Modelos" compact={compact} />
                <NavSubLink to="/app/registro-diario" icon={ClipboardList} label="Registro diário" compact={compact} />
              </NavAccordion>

              <NavAccordion
                label="Financeiro"
                icon={Wallet}
                paths={financeiroPaths}
                open={financeiroOpen}
                onToggle={() => setFinanceiroOpen((v) => !v)}
                compact={compact}
              >
                <NavSubLink to="/app/cobrancas" icon={Banknote} label="Cobranças" compact={compact} />
                <NavSubLink to="/app/recebiveis" end icon={PieChart} label="Recebíveis" compact={compact} />
                <NavSubLink
                  to="/app/relatorio-cobranca"
                  icon={MessageCircle}
                  label="Relatório de cobrança"
                  compact={compact}
                />
                <NavSubLink
                  to="/app/financeiro-empresa"
                  icon={Landmark}
                  label="Financeiro empresa"
                  compact={compact}
                />
                <NavSubLink to="/app/repasses" icon={Split} label="Repasses" compact={compact} />
                {canUpdate && (
                  <NavSubLink to="/app/assinaturas" icon={Package} label="Assinaturas" compact={compact} />
                )}
              </NavAccordion>

              {showSistemaSection && (
                <NavAccordion
                  label="Sistema"
                  icon={Settings}
                  paths={sistemaPaths}
                  open={sistemaOpen}
                  onToggle={() => setSistemaOpen((v) => !v)}
                  compact={compact}
                >
                  {canManageUsers && (
                    <NavSubLink to="/app/usuarios" icon={UserCog} label="Usuários" compact={compact} />
                  )}
                  {canViewAudit && (
                    <NavSubLink to="/app/auditoria" icon={Shield} label="Auditoria" compact={compact} />
                  )}
                </NavAccordion>
              )}
            </>
          )}

          {/* ——— Cliente comprador/vendedor ——— */}
          {isCliente && !isAssessor && (
            <>
              <NavSectionLabel compact={compact}>Minhas compras</NavSectionLabel>
              <NavTopLink
                to="/app/animais"
                icon={PawPrint}
                label={clientPortalLabels.animalsNav}
                compact={compact}
              />
              <NavAccordion
                label="Operação"
                icon={FileText}
                paths={['/app/contratos', '/app/cobrancas']}
                open={operacaoOpen}
                onToggle={() => setOperacaoOpen((v) => !v)}
                compact={compact}
              >
                <NavSubLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
                <NavSubLink to="/app/cobrancas" icon={Banknote} label="Cobranças" compact={compact} />
              </NavAccordion>
            </>
          )}

          {isAssessor && (
            <NavAccordion
              label="Assessoria"
              icon={Gavel}
              paths={['/app/leiloes', '/app/contratos', '/app/repasses']}
              open={operacaoOpen}
              onToggle={() => setOperacaoOpen((v) => !v)}
              compact={compact}
            >
              <NavSubLink to="/app/leiloes" icon={Gavel} label="Leilões" compact={compact} />
              <NavSubLink to="/app/contratos" icon={FileText} label="Contratos" compact={compact} />
              <NavSubLink to="/app/repasses" icon={Split} label="Repasses" compact={compact} />
            </NavAccordion>
          )}

          <NavSectionLabel compact={compact}>Conta</NavSectionLabel>
          <NavAccordion
            label="Minha conta"
            icon={UserCircle}
            paths={contaPaths}
            open={contaOpen}
            onToggle={() => setContaOpen((v) => !v)}
            compact={compact}
          >
            <NavSubLink to="/app/perfil" icon={UserCircle} label="Meu perfil" compact={compact} />
            <AssistantSidebarButton compact={compact} />
            <NavSubLink to="/app/alterar-senha" icon={KeyRound} label="Alterar senha" compact={compact} />
          </NavAccordion>
        </nav>

        <div className="border-t border-brand-gold/25 p-3">
          <div
            className={`flex items-center gap-3 rounded-xl bg-gradient-to-br from-brand-gold to-[#d4954a] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ${
              compact ? 'md:justify-center' : ''
            }`}
          >
            <UserAvatar
              name={user?.name || 'U'}
              avatarUrl={user?.avatarUrl}
              size="md"
              className="!bg-brand-dark-brown !text-white !ring-2 !ring-brand-dark-brown/20"
            />
            {!compact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-dark-brown">{user?.name}</p>
                <p className="truncate text-xs font-medium text-brand-dark-brown/80">
                  {user ? roleLabel[user.role] : ''}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-200 transition hover:bg-white/5 hover:text-red-100 md:hidden ${
              compact ? 'justify-center' : ''
            }`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!compact && <span>Sair</span>}
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
            <SupportMenu userName={user?.name} />
            <NotificationBell
              userId={user?.id}
              stats={alertStats}
              canManageSubs={canUpdate}
              loading={alertsLoading}
            />
            <HeaderDateTime className="mr-1 hidden lg:block" />

            <ThemeIconButton className="hidden md:inline-flex" />

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="hidden items-center gap-1.5 rounded-xl border border-brand-beige bg-white px-3 py-2 text-xs font-medium text-brand-brown transition hover:bg-brand-off-white md:inline-flex"
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">{collapsed ? 'Expandir' : 'Recolher'}</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-2.5 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 sm:px-3"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <AiAssistantFab />
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
