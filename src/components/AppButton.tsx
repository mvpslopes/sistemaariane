import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: AppButtonVariant;
  children: ReactNode;
}

const variantClass: Record<AppButtonVariant, string> = {
  primary:
    'bg-brand-brown text-white shadow-lg shadow-brand-brown/20 hover:bg-brand-olive active:scale-[0.98]',
  secondary:
    'border border-brand-beige bg-white text-brand-dark-brown hover:bg-brand-off-white active:scale-[0.98]',
  danger:
    'border border-red-200 bg-white text-red-600 hover:bg-red-50 active:scale-[0.98]',
  ghost: 'text-brand-olive hover:bg-brand-off-white active:scale-[0.98]',
};

export default function AppButton({
  loading = false,
  variant = 'primary',
  children,
  disabled,
  className = '',
  type = 'button',
  ...props
}: AppButtonProps) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${variantClass[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
