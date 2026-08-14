import { MessagesSquare } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { NavIconWrap } from './SidebarNav';
import { useChatUnread } from '../hooks/useChatUnread';

export default function ChatSidebarLink({ compact = false }: { compact?: boolean }) {
  const { count } = useChatUnread(true);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-brand-gold/10 text-white'
        : 'text-brand-beige/70 hover:bg-white/5 hover:text-white'
    } ${compact ? 'justify-center' : ''}`;

  return (
    <NavLink to="/app/mensagens" className={linkClass} title="Mensagens">
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-gold" />
          )}
          <NavIconWrap active={isActive} size="md">
            <MessagesSquare
              className={`h-[17px] w-[17px] transition-transform duration-200 ${
                isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:-rotate-3 group-active:scale-95'
              }`}
              strokeWidth={isActive ? 2.25 : 2}
            />
          </NavIconWrap>
          {!compact && (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span>Mensagens</span>
              {count > 0 && (
                <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-brand-gold px-1.5 py-0.5 text-[10px] font-bold text-brand-dark-brown">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
          )}
          {compact && count > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand-gold ring-2 ring-brand-dark-brown" />
          )}
        </>
      )}
    </NavLink>
  );
}
