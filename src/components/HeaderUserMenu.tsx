import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, UserCircle } from 'lucide-react';
import UserAvatar from './UserAvatar';

const roleLabel: Record<string, string> = {
  root: 'Root',
  admin: 'Admin',
  user: 'Operador',
  cliente: 'Cliente',
};

interface HeaderUserMenuProps {
  name?: string;
  role?: string;
  avatarUrl?: string | null;
  onLogout: () => void;
  /** Só avatar — cabeçalho mobile. */
  compact?: boolean;
}

export default function HeaderUserMenu({
  name,
  role,
  avatarUrl,
  onLogout,
  compact = false,
}: HeaderUserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayName = name || 'Usuário';
  const displayRole = role ? roleLabel[role] || role : '';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          compact
            ? 'flex items-center rounded-full border border-brand-beige bg-white p-0.5 text-left transition hover:bg-brand-off-white'
            : 'flex max-w-[13rem] items-center gap-2 rounded-xl border border-brand-beige bg-white py-1 pl-1 pr-2 text-left transition hover:bg-brand-off-white lg:max-w-[16rem]'
        }
        title={displayName}
        aria-label="Menu da conta"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={displayName} avatarUrl={avatarUrl} size="md" />
        {!compact && (
          <>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight text-brand-dark-brown">
                {displayName}
              </span>
              {displayRole && (
                <span className="block truncate text-[11px] font-medium leading-tight text-brand-olive">
                  {displayRole}
                </span>
              )}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-brand-olive transition ${open ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.4rem)] z-[61] w-52 overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-2xl"
          role="menu"
          aria-label="Conta"
        >
          <Link
            to="/app/perfil"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-brand-dark-brown transition hover:bg-brand-off-white"
          >
            <UserCircle className="h-4 w-4 text-brand-olive" />
            Meu perfil
          </Link>
          <Link
            to="/app/alterar-senha"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-brand-dark-brown transition hover:bg-brand-off-white"
          >
            <KeyRound className="h-4 w-4 text-brand-olive" />
            Alterar senha
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2.5 border-t border-brand-beige px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
