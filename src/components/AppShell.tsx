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
  HelpCircle,
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
import HelpMenu from './HelpMenu';
import { useIsMobile } from '../hooks/useIsMobile';
import { useOperationalAlerts } from '../hooks/useOperationalAlerts';
import PageTransition from './PageTransition';
import AppBrandMark from './AppBrandMark';

const roleLabel: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Usuário',
  cliente: 'Cliente',
};

const cadastroPaths = ['/app/pessoas', '/app/animais', '/app/reproducao'];
const operacaoPaths = ['/app/leiloes', '/app/contratos', '/app/modelos-contrato'];
const financeiroPaths = [
  '/app/cobrancas',
  '/app/recebiveis',
  '/app/financeiro-empresa',
  '/app/repasses',
  '/app/assinaturas',
];
const sistemaPaths = ['/app/usuarios', '/app/auditoria'];
const contaPaths = ['/app/perfil', '/app/alterar-senha', '/app/ajuda'];

export default function AppShell() {
  const { user, logout, canManageUsers, canViewAudit, canUpdate, hasRole } = useAuth();
  const navigate = useNavigate();
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
  const isAssessor = !!user?.isAssessor && isCliente;
  const pathname = location.pathname;
  const { stats: alertStats, loading: alertsLoading } = useOperationalAlerts(!!user);

  const compact = !isMobile && collapsed;

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
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Link to="/app" className="flex shrink-0 items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-gold/30 bg-gradient-to-br from-brand-gold/20 to-brand-dark-brown/10 text-xs font-bold text-brand-brown shadow-sm">
                  AA
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block truncate text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
                    {isAssessor ? 'Portal assessor' : isCliente ? 'Portal cliente' : 'Gestão de Haras'}
                  </span>
                  <span className="block truncate text-sm font-semibold text-brand-dark-brown">{meta.title}</span>
                </span>
              </Link>
              <div className="min-w-0 sm:hidden">
                <h1 className="truncate text-lg font-semibold text-brand-dark-brown">{meta.title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <HelpMenu isCliente={isCliente} isAssessor={isAssessor} compact />
              <NotificationBell
                userId={user?.id}
                stats={alertStats}
                canManageSubs={canUpdate}
                loading={alertsLoading}
                compact
              />
              <SupportMenu userName={user?.name} compact />
              {!isCliente && (
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-beige bg-white text-brand-brown transition hover:bg-brand-off-white"
                  title="Mais opções"
                  aria-label="Mais opções"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-600 transition hover:bg-red-50"
                title="Sair"
                aria-label="Sair da conta"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <Link
                to="/app/perfil"
                className="shrink-0 rounded-full ring-2 ring-brand-beige/60 transition hover:ring-brand-olive/40"
                title="Meu perfil"
              >
                <UserAvatar name={user?.name || 'U'} size="md" />
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-28">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>

        <AppBottomNav />
        <MobileMoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
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
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[min(18rem,86vw)] flex-col bg-gradient-to-b from-brand-dark-brown to-[#3d2f26] text-white shadow-2xl transition-transform duration-300 ease-out md:static md:z-auto md:shadow-none md:transition-[width] ${
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
                <NavSubLink to="/app/recebiveis" icon={PieChart} label="Recebíveis" compact={compact} />
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
            <NavSubLink to="/app/ajuda" icon={HelpCircle} label="Ajuda" compact={compact} />
            <NavSubLink to="/app/alterar-senha" icon={KeyRound} label="Alterar senha" compact={compact} />
          </NavAccordion>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${compact ? 'md:justify-center' : ''}`}
          >
            <UserAvatar name={user?.name || 'U'} size="md" className="!ring-white/20" />
            {!compact && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-brand-beige/50">
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
            <HelpMenu isCliente={isCliente} isAssessor={isAssessor} />
            <SupportMenu userName={user?.name} />
            <NotificationBell
              userId={user?.id}
              stats={alertStats}
              canManageSubs={canUpdate}
              loading={alertsLoading}
            />
            <HeaderDateTime className="mr-1 hidden lg:block" />

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
    </div>
  );
}
