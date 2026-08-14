import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Monitor },
];

interface ThemeToggleProps {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  return (
    <div className="space-y-2">
      {!compact && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-olive">Aparência</p>
          <p className="mt-0.5 text-sm text-brand-olive/80">Escolha o tema do sistema</p>
        </div>
      )}
      <div
        className="inline-flex w-full rounded-xl border border-brand-beige bg-brand-off-white p-1"
        role="radiogroup"
        aria-label="Tema do sistema"
      >
        {options.map(({ value, label, Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm ${
                active
                  ? 'bg-white text-brand-dark-brown shadow-sm'
                  : 'text-brand-olive hover:text-brand-dark-brown'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
