import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

/** Ícone com feedback visual no hover / ativo / grupo aberto. */
export function NavIconWrap({
  active,
  open,
  size = 'md',
  children,
}: {
  active?: boolean;
  open?: boolean;
  size?: 'sm' | 'md';
  children: ReactNode;
}) {
  const box = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg transition-all duration-200 ${box} ${
        active
          ? 'bg-brand-gold/20 text-brand-gold'
          : open
            ? 'bg-brand-gold/15 text-brand-gold'
            : 'text-brand-beige/75 group-hover:scale-110 group-hover:bg-brand-gold/10 group-hover:text-brand-gold'
      }`}
    >
      {children}
    </span>
  );
}

interface NavAccordionProps {
  label: string;
  icon: LucideIcon;
  paths: string[];
  open: boolean;
  onToggle: () => void;
  compact: boolean;
  children: ReactNode;
}

export function NavAccordion({
  label,
  icon: Icon,
  paths,
  open,
  onToggle,
  compact,
  children,
}: NavAccordionProps) {
  const { pathname } = useLocation();
  const onSection = sectionIsActive(paths, pathname);
  const expanded = compact || open;

  if (compact) {
    return (
      <div className="mt-0.5">
        <div
          className={`mb-1 flex justify-center rounded-xl py-2 ${
            onSection ? 'bg-white/5 text-brand-gold' : 'text-brand-beige/70'
          }`}
          title={label}
        >
          <NavIconWrap active={onSection} open={open} size="md">
            <Icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:-rotate-6" strokeWidth={2} />
          </NavIconWrap>
        </div>
        <div className="flex flex-col gap-0.5">{children}</div>
      </div>
    );
  }

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
          onSection || open
            ? 'bg-white/[0.07] text-white'
            : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
        }`}
        title={label}
        aria-expanded={open}
      >
        <NavIconWrap active={onSection && !open} open={open} size="md">
          <Icon
            className={`h-[17px] w-[17px] transition-transform duration-200 ${
              open ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3 group-active:scale-95'
            }`}
            strokeWidth={onSection || open ? 2.25 : 2}
          />
        </NavIconWrap>
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-all duration-200 ${
            open ? 'rotate-0 text-brand-gold/80' : '-rotate-90 text-brand-beige/45 group-hover:text-brand-gold/70'
          }`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="mt-0.5 flex flex-col gap-0.5 pb-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}

interface NavSubLinkProps {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  compact: boolean;
}

export function NavSubLink({ to, end, icon: Icon, label, compact }: NavSubLinkProps) {
  const subLinkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-2.5 rounded-xl py-2 text-sm font-medium transition-all duration-200 ${
      compact ? 'justify-center px-2' : 'px-2.5 pl-3'
    } ${
      isActive
        ? 'bg-brand-gold/10 text-white'
        : 'text-brand-beige/65 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <NavLink to={to} end={end} className={subLinkClass} title={label}>
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
          )}
          {!compact && (
            <span className="ml-2 h-1 w-1 shrink-0 rounded-full bg-brand-beige/25" aria-hidden />
          )}
          <NavIconWrap active={isActive} size="sm">
            <Icon
              className={`h-4 w-4 transition-transform duration-200 ${
                isActive ? 'scale-110' : 'group-hover:scale-110 group-active:scale-90'
              }`}
              strokeWidth={isActive ? 2.25 : 2}
            />
          </NavIconWrap>
          {!compact && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

interface NavTopLinkProps {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  compact: boolean;
}

export function NavTopLink({ to, end, icon: Icon, label, compact }: NavTopLinkProps) {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-brand-gold/10 text-white'
        : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
    } ${compact ? 'justify-center' : ''}`;

  return (
    <NavLink to={to} end={end} className={linkClass} title={label}>
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
          )}
          <NavIconWrap active={isActive} size="md">
            <Icon
              className={`h-[17px] w-[17px] transition-transform duration-200 ${
                isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3 group-active:scale-95'
              }`}
              strokeWidth={isActive ? 2.25 : 2}
            />
          </NavIconWrap>
          {!compact && <span>{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export function NavSectionLabel({ children, compact }: { children: ReactNode; compact?: boolean }) {
  if (compact) return null;
  return (
    <p className="mb-1 mt-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-gold/45 first:mt-0">
      {children}
    </p>
  );
}

/** Abre a seção sanfona quando a rota atual pertence a ela. */
export function sectionIsActive(paths: string[], pathname: string) {
  return paths.some(
    (p) => pathname === p || (p !== '/app' && pathname.startsWith(`${p}/`))
  );
}
