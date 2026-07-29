import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  PawPrint,
  UserCog,
  LogOut,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const roleLabel: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Usuário',
  cliente: 'Cliente',
};

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/app': { title: 'Dashboard', subtitle: 'Visão geral do plantel e cadastros' },
  '/app/clientes': { title: 'Clientes', subtitle: 'Criadores e proprietários' },
  '/app/animais': { title: 'Animais', subtitle: 'Plantel e documentação básica' },
  '/app/usuarios': { title: 'Usuários', subtitle: 'Acessos ao sistema' },
  '/app/alterar-senha': { title: 'Alterar senha', subtitle: 'Segurança da sua conta' },
};

export default function AppShell() {
  const { user, logout, canManageUsers, hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const isCliente = hasRole('cliente');

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

  const meta = pageMeta[location.pathname] || pageMeta['/app'];
  const today = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());

  return (
    <div className="flex min-h-screen bg-brand-off-white text-brand-dark-brown">
      <aside
        className={`sticky top-0 flex h-screen flex-col bg-gradient-to-b from-brand-dark-brown to-[#3d2f26] text-white transition-all duration-300 ${
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

        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
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
            <NavLink to="/app/clientes" className={linkClass} title="Clientes">
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
                  )}
                  <Users className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>Clientes</span>}
                </>
              )}
            </NavLink>
          )}
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
        </nav>

        <div className="space-y-1 border-t border-white/10 p-3">
          <NavLink to="/app/alterar-senha" className={linkClass} title="Alterar senha">
            <KeyRound className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Alterar senha</span>}
          </NavLink>

          <div
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/90 text-sm font-semibold text-brand-dark-brown">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
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
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-brand-beige/70 transition-colors hover:bg-red-500/15 hover:text-red-200 ${
              collapsed ? 'justify-center' : ''
            }`}
            title="Sair"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-brand-beige/40 transition-colors hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-brand-beige/70 bg-white/80 px-6 py-4 backdrop-blur-md">
          <div>
            <h1 className="text-lg font-semibold text-brand-dark-brown">{meta.title}</h1>
            <p className="text-xs text-brand-olive">{meta.subtitle}</p>
          </div>
          <p className="hidden text-xs capitalize text-brand-olive/70 sm:block">{today}</p>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
