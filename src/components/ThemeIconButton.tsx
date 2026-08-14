import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeIconButtonProps {
  className?: string;
}

/** Alternância rápida claro/escuro — preferência completa fica em Meu perfil. */
export default function ThemeIconButton({ className = '' }: ThemeIconButtonProps) {
  const { preference, resolved, setPreference } = useTheme();

  const toggle = () => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setPreference(next);
  };

  const isDark = resolved === 'dark';
  const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
  const hint =
    preference === 'system'
      ? `${label} (atualmente segue o sistema)`
      : label;

  return (
    <button
      type="button"
      onClick={toggle}
      title={hint}
      aria-label={label}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-brand-olive/55 transition hover:bg-brand-off-white hover:text-brand-dark-brown active:scale-95 ${className}`}
    >
      {isDark ? <Sun className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={1.75} />}
    </button>
  );
}
