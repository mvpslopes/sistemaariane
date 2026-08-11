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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MobileMoreSheetProps {
  open: boolean;
  onClose: () => void;
}

const linkClass =
  'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-brand-dark-brown transition hover:bg-brand-off-white';

export default function MobileMoreSheet({ open, onClose }: MobileMoreSheetProps) {
  const { canManageUsers, canViewAudit } = useAuth();

  if (!open) return null;

  const items = [
    { to: '/app/leiloes', icon: Gavel, label: 'Leilões' },
    { to: '/app/repasses', icon: Split, label: 'Repasses' },
    { to: '/app/modelos-contrato', icon: FileStack, label: 'Modelos de contrato' },
    ...(canManageUsers ? [{ to: '/app/usuarios', icon: UserCog, label: 'Usuários' }] : []),
    ...(canViewAudit ? [{ to: '/app/auditoria', icon: Shield, label: 'Auditoria' }] : []),
    { to: '/app/perfil', icon: UserCircle, label: 'Meu perfil' },
    { to: '/app/alterar-senha', icon: KeyRound, label: 'Alterar senha' },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/45 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-brand-beige bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-2xl md:hidden"
        role="dialog"
        aria-label="Mais opções"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-brand-dark-brown">Mais opções</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-brand-olive hover:bg-brand-off-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="max-h-[min(60vh,24rem)] space-y-1 overflow-y-auto">
          {items.map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to} onClick={onClose} className={linkClass}>
              <Icon className="h-5 w-5 shrink-0 text-brand-brown" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
