import type { ReactNode } from 'react';

interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileCard({ children, onClick, className = '' }: MobileCardProps) {
  const interactive = !!onClick;

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={`rounded-2xl border border-brand-beige bg-white p-4 shadow-card ${
        interactive
          ? 'cursor-pointer transition hover:border-brand-olive/30 hover:shadow-card-hover active:scale-[0.99]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
