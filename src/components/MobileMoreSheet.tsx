import { Link } from 'react-router-dom';
import {
  Gavel,
  Split,
  FileStack,
  UserCog,
  Shield,
  KeyRound,
  UserCircle,
  X,
  PieChart,
  Landmark,
  Dna,
  Package,
  HelpCircle,
  Headphones,
  LogOut,
  MessageCircle,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useAnimatedPresence } from '../hooks/useAnimatedPresence';
import { buildSupportMessage, supportWhatsAppHref, TECH_SUPPORT } from '../constants/support';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const linkClass =
  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-brand-dark-brown transition hover:bg-brand-off-white active:scale-[0.99]';

export default function MobileMoreSheet({ open, onClose, onLogout }: MobileMoreSheetProps) {
  const { user, canManageUsers, canViewAudit, canUpdate, hasRole } = useAuth();
  const isStaff = !hasRole('cliente');
  const isAssessor = !!user?.isAssessor && hasRole('cliente');
  const { mounted, visible, duration } = useAnimatedPresence(open, 320);

  if (!mounted) return null;

  const supportHref = supportWhatsAppHref(buildSupportMessage(user?.name));

  const items: Array<
    | { type: 'link'; to: string; icon: typeof HelpCircle; label: string }
    | { type: 'external'; href: string; icon: typeof Headphones; label: string; subtitle?: string }
  > = [
    { type: 'link', to: '/app/ajuda', icon: HelpCircle, label: 'Central de ajuda' },
    {
      type: 'external',
      href: supportHref,
      icon: Headphones,
      label: 'Suporte técnico',
      subtitle: TECH_SUPPORT.phoneDisplay,
    },
  ];

  if (isStaff) {
    items.push(
      { type: 'link', to: '/app/leiloes', icon: Gavel, label: 'Leilões' },
      { type: 'link', to: '/app/reproducao', icon: Dna, label: 'Reprodução' },
      { type: 'link', to: '/app/registro-diario', icon: ClipboardList, label: 'Registro diário' },
      { type: 'link', to: '/app/recebiveis', icon: PieChart, label: 'Recebíveis' },
      { type: 'link', to: '/app/financeiro-empresa', icon: Landmark, label: 'Financeiro da empresa' }
    );
    if (canUpdate) {
      items.push({ type: 'link', to: '/app/assinaturas', icon: Package, label: 'Assinaturas SaaS' });
    }
    items.push(
      { type: 'link', to: '/app/repasses', icon: Split, label: 'Repasses' },
      { type: 'link', to: '/app/modelos-contrato', icon: FileStack, label: 'Modelos de contrato' }
    );
    if (canManageUsers) {
      items.push({ type: 'link', to: '/app/usuarios', icon: UserCog, label: 'Usuários' });
    }
    if (canViewAudit) {
      items.push({ type: 'link', to: '/app/auditoria', icon: Shield, label: 'Auditoria' });
    }
  } else if (isAssessor) {
    items.push({ type: 'link', to: '/app/leiloes', icon: Gavel, label: 'Leilões' });
  }

  items.push(
    { type: 'link', to: '/app/perfil', icon: UserCircle, label: 'Meu perfil' },
    { type: 'link', to: '/app/alterar-senha', icon: KeyRound, label: 'Alterar senha' }
  );

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/45 transition-opacity md:hidden ${visible ? 'opacity-100' : 'opacity-0'}`}
        style={{ transitionDuration: `${duration}ms` }}
        onClick={onClose}
        aria-hidden
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-brand-beige bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl transition-transform md:hidden ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ transitionDuration: `${duration}ms`, transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        role="dialog"
        aria-label="Mais opções"
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-brand-dark-brown">Mais opções</h2>
            {isAssessor && (
              <p className="text-xs text-brand-olive">Portal assessor</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-brand-olive transition hover:bg-brand-off-white active:scale-95"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="max-h-[min(60vh,24rem)] space-y-1 overflow-y-auto">
          {items.map((item) => {
            if (item.type === 'external') {
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={onClose}
                  className={linkClass}
                >
                  <item.icon className="h-5 w-5 shrink-0 text-brand-olive" />
                  <span className="min-w-0">
                    <span className="block">{item.label}</span>
                    {item.subtitle && (
                      <span className="block text-xs font-normal text-brand-olive">{item.subtitle}</span>
                    )}
                  </span>
                  <MessageCircle className="ml-auto h-4 w-4 shrink-0 text-[#25D366]" />
                </a>
              );
            }
            return (
              <Link key={item.to} to={item.to} onClick={onClose} className={linkClass}>
                <item.icon className="h-5 w-5 shrink-0 text-brand-olive" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={`${linkClass} w-full text-red-600 hover:bg-red-50`}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sair da conta
          </button>
        </nav>
      </div>
    </>
  );
}
