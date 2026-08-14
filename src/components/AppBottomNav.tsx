import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  PawPrint,
  FileText,
  Banknote,
  UserCircle,
  Users,
  Gavel,
  Split,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { clientPortalLabels } from '../constants/clientPortalLabels';
import { assessorPortalLabels } from '../constants/assessorPortalLabels';

interface NavItem {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  title?: string;
}

function assessorItems(): NavItem[] {
  return [
    { to: '/app', end: true, icon: LayoutDashboard, label: 'Início' },
    {
      to: '/app/leiloes',
      icon: Gavel,
      label: 'Leilões',
      title: assessorPortalLabels.eventsNav,
    },
    { to: '/app/contratos', icon: FileText, label: 'Contratos' },
    { to: '/app/repasses', icon: Split, label: 'Repasses' },
    { to: '/app/perfil', icon: UserCircle, label: 'Perfil' },
  ];
}

function clienteItems(): NavItem[] {
  return [
    { to: '/app', end: true, icon: LayoutDashboard, label: 'Início' },
    {
      to: '/app/animais',
      icon: PawPrint,
      label: 'Compras',
      title: clientPortalLabels.animalsNav,
    },
    { to: '/app/contratos', icon: FileText, label: 'Contratos' },
    { to: '/app/cobrancas', icon: Banknote, label: 'Cobranças' },
    { to: '/app/perfil', icon: UserCircle, label: 'Perfil' },
  ];
}

function staffItems(): NavItem[] {
  return [
    { to: '/app', end: true, icon: LayoutDashboard, label: 'Início' },
    { to: '/app/leiloes', icon: Gavel, label: 'Leilões' },
    { to: '/app/pessoas', icon: Users, label: 'Pessoas' },
    { to: '/app/contratos', icon: FileText, label: 'Contratos' },
    { to: '/app/cobrancas', icon: Banknote, label: 'Cobranças' },
  ];
}

export default function AppBottomNav() {
  const { hasRole, user } = useAuth();
  const isAssessor = !!user?.isAssessor && hasRole('cliente');
  const items = isAssessor
    ? assessorItems()
    : hasRole('cliente')
      ? clienteItems()
      : staffItems();

  return (
    <nav
      className="theme-fixed fixed inset-x-0 bottom-0 z-30 border-t-2 border-brand-gold/40 bg-gradient-to-t from-[#3d2f26] to-brand-dark-brown pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(79,62,50,0.35)] md:hidden"
      aria-label="Navegação principal"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-0.5 px-2 pt-2">
        {items.map(({ to, end, icon: Icon, label, title }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              title={title || label}
              className="block rounded-2xl px-1 pb-2.5 pt-1 transition"
            >
              {({ isActive }) => (
                <span
                  className={`relative flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 transition-all ${
                    isActive
                      ? 'bg-white/15 text-white shadow-inner'
                      : 'text-brand-beige/55 active:bg-white/5 active:text-brand-beige'
                  }`}
                >
                  {isActive && (
                    <span className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand-gold" aria-hidden />
                  )}
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${
                      isActive ? 'bg-brand-gold text-brand-dark-brown shadow-md' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  <span
                    className={`max-w-full truncate text-[11px] leading-none ${
                      isActive ? 'font-semibold text-white' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
