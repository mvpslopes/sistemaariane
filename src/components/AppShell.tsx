import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  UserCog,
  LogOut,
  ChevronDown,
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import UserAvatar from './UserAvatar';

const roleLabel: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Usuário',
  cliente: 'Cliente',
};

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/app': { title: 'Dashboard', subtitle: 'Visão geral do plantel e cadastros' },
  '/app/pessoas': {
    title: 'Pessoas',
    subtitle: 'Compradores, vendedores, assessores e testemunhas em um só cadastro',
  },
  '/app/animais': { title: 'Animais', subtitle: 'Plantel e documentação básica' },
  '/app/leiloes': {
    title: 'Leilões',
    subtitle: 'Eventos, lotes e registro de arremates',
  },
  '/app/contratos': { title: 'Contratos', subtitle: 'Vendas e aceites digitais' },
  '/app/modelos-contrato': {
    title: 'Modelos de contrato',
    subtitle: 'Versos (cláusulas) reutilizáveis na nota de leilão',
  },
  '/app/cobrancas': { title: 'Cobranças', subtitle: 'Parcelas, PIX e boletos' },
  '/app/repasses': {
    title: 'Repasses',
    subtitle: 'Assessoria, dono do animal e assessores por parcela',
  },
  '/app/perfil': { title: 'Meu perfil', subtitle: 'Nome e foto de exibição' },
  '/app/usuarios': { title: 'Usuários', subtitle: 'Acessos ao sistema' },
  '/app/alterar-senha': { title: 'Alterar senha', subtitle: 'Segurança da sua conta' },
};

const cadastroPaths = ['/app/pessoas', '/app/animais'];

const contaPaths = ['/app/perfil', '/app/alterar-senha'];

export default function AppShell() {
  const { user, logout, canManageUsers, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [cadastrosOpen, setCadastrosOpen] = useState(true);
  const [contaOpen, setContaOpen] = useState(false);
  const isCliente = hasRole('cliente');
  const onCadastros = cadastroPaths.some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );
  const onConta = contaPaths.some((p) => location.pathname === p);

  useEffect(() => {
    if (onCadastros) setCadastrosOpen(true);
  }, [onCadastros]);

  useEffect(() => {
    if (onConta) setContaOpen(true);
  }, [onConta]);

  // Garante que o body não fique travado após fechar modais
  useEffect(() => {
    document.body.style.overflow = '';
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
    } ${collapsed ? 'justify-center' : ''}`;

  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-3 rounded-xl py-2 text-sm font-medium transition-all duration-200 ${
      collapsed ? 'justify-center px-3' : 'px-3 pl-10'
    } ${
      isActive
        ? 'bg-white/10 text-white'
        : 'text-brand-beige/65 hover:bg-white/5 hover:text-white'
    }`;

  const meta = pageMeta[location.pathname] || pageMeta['/app'];
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());

  const showCadastrosChildren = collapsed || cadastrosOpen;
  const showContaChildren = collapsed || contaOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-brand-off-white text-brand-dark-brown">
      <aside
        className={`flex h-full shrink-0 flex-col bg-gradient-to-b from-brand-dark-brown to-[#3d2f26] text-white transition-all duration-300 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-gold to-brand-gold-light text-base font-bold text-brand-dark-brown shadow-lg shadow-black/20">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-wide text-white">Sistema Ariane</p>
              <p className="truncate text-xs text-brand-beige/50">Gestão de Haras</p>
            </div>
          )}
        </div>

        <nav className="scrollbar-sidebar flex flex-1 flex-col gap-1 overflow-y-auto px-3 pt-2">
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-beige/35">
              Principal
            </p>
          )}
          <NavLink to="/app" end className={linkClass} title="Dashboard">
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                )}
                <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Dashboard</span>}
              </>
            )}
          </NavLink>

          {!isCliente && (
            <div className="mt-1">
              {!collapsed ? (
                <button
                  type="button"
                  onClick={() => setCadastrosOpen((v) => !v)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    onCadastros
                      ? 'bg-white/5 text-white'
                      : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
                  }`}
                  title="Cadastros"
                >
                  <FolderOpen className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 text-left">Cadastros</span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${
                      cadastrosOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </button>
              ) : (
                <div
                  className={`mb-1 flex justify-center rounded-xl py-2 ${
                    onCadastros ? 'bg-white/5 text-white' : 'text-brand-beige/70'
                  }`}
                  title="Cadastros"
                >
                  <FolderOpen className="h-[18px] w-[18px]" />
                </div>
              )}

              {showCadastrosChildren && (
                <div className={`flex flex-col gap-0.5 ${collapsed ? '' : 'mt-0.5'}`}>
                  <NavLink to="/app/pessoas" className={subLinkClass} title="Pessoas">
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                        )}
                        <Users className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Pessoas</span>}
                      </>
                    )}
                  </NavLink>
                  <NavLink to="/app/animais" className={subLinkClass} title="Animais">
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                        )}
                        <PawPrint className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>Animais</span>}
                      </>
                    )}
                  </NavLink>
                </div>
              )}
            </div>
          )}

          {isCliente && (
            <NavLink to="/app/animais" className={linkClass} title="Animais">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <PawPrint className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Animais</span>}
                </>
              )}
            </NavLink>
          )}

          {!collapsed && (
            <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-beige/35">
              Operação
            </p>
          )}
          {!isCliente && (
            <NavLink to="/app/leiloes" className={linkClass} title="Leilões">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <Gavel className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Leilões</span>}
                </>
              )}
            </NavLink>
          )}
          <NavLink to="/app/contratos" className={linkClass} title="Contratos">
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                )}
                <FileText className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Contratos</span>}
              </>
            )}
          </NavLink>
          {!isCliente && (
            <NavLink to="/app/modelos-contrato" className={linkClass} title="Modelos de contrato">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <FileStack className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Modelos</span>}
                </>
              )}
            </NavLink>
          )}
          <NavLink to="/app/cobrancas" className={linkClass} title="Cobranças">
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                )}
                <Banknote className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span>Cobranças</span>}
              </>
            )}
          </NavLink>
          {!isCliente && (
            <NavLink to="/app/repasses" className={linkClass} title="Repasses">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <Split className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Repasses</span>}
                </>
              )}
            </NavLink>
          )}
          {canManageUsers && (
            <NavLink to="/app/usuarios" className={linkClass} title="Usuários">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <UserCog className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Usuários</span>}
                </>
              )}
            </NavLink>
          )}

          {/* Conta */}
          {!collapsed && (
            <p className="mb-1 mt-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-brand-beige/35">
              Conta
            </p>
          )}
          <div className="mt-0.5">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => setContaOpen((v) => !v)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                  onConta
                    ? 'bg-white/5 text-white'
                    : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
                }`}
                title="Minha conta"
              >
                <UserCircle className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 text-left">Minha conta</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 opacity-60 transition-transform ${
                    contaOpen ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
            ) : (
              <div
                className={`mb-1 flex justify-center rounded-xl py-2 ${
                  onConta ? 'bg-white/5 text-white' : 'text-brand-beige/70'
                }`}
                title="Minha conta"
              >
                <UserCircle className="h-[18px] w-[18px]" />
              </div>
            )}

            {showContaChildren && (
              <div className={`flex flex-col gap-0.5 ${collapsed ? '' : 'mt-0.5'}`}>
                <NavLink to="/app/perfil" className={subLinkClass} title="Meu perfil">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                      )}
                      <UserCircle className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Meu perfil</span>}
                    </>
                  )}
                </NavLink>
                <NavLink to="/app/alterar-senha" className={subLinkClass} title="Alterar senha">
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                      )}
                      <KeyRound className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Alterar senha</span>}
                    </>
                  )}
                </NavLink>
              </div>
            )}
          </div>
        </nav>

        <div className="border-t border-white/10 p-3">
          <div
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}
          >
            <UserAvatar
              name={user?.name || 'U'}
              avatarUrl={user?.avatarUrl}
              size="md"
              className="!ring-white/20"
            />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{user?.name}</p>
                <p className="truncate text-xs text-brand-beige/50">
                  {user ? roleLabel[user.role] : ''}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-10 flex shrink-0 items-center justify-between gap-4 border-b border-brand-beige/70 bg-white/90 px-4 py-3 backdrop-blur-md md:px-6 md:py-4">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-brand-dark-brown">{meta.title}</h1>
            <p className="truncate text-xs text-brand-olive">{meta.subtitle}</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <p className="mr-1 hidden text-xs capitalize text-brand-olive/70 lg:block">{today}</p>

            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brand-beige bg-white px-3 py-2 text-xs font-medium text-brand-brown transition hover:bg-brand-off-white"
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
