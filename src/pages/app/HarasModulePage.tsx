import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, Construction } from 'lucide-react';

type HarasModulePageProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export default function HarasModulePage({ title, description, icon: Icon }: HarasModulePageProps) {
  return (
    <div className="mx-auto max-w-lg space-y-5 py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-beige/50 text-brand-brown">
        <Icon className="h-8 w-8" />
      </div>
      <div className="space-y-2">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
          <Construction className="h-3.5 w-3.5" />
          Em desenvolvimento
        </p>
        <h2 className="text-xl font-semibold text-brand-dark-brown">{title}</h2>
        <p className="text-sm leading-relaxed text-brand-olive">{description}</p>
      </div>
      <p className="text-xs text-brand-olive/80">
        Este módulo faz parte do plantel / gestão de haras. Administradores veem todos os módulos; clientes
        criadores verão apenas o que estiver liberado no plano.
      </p>
      <Link
        to="/app/animais"
        className="inline-flex items-center gap-2 rounded-xl border border-brand-beige bg-white px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-off-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Ir para animais do plantel
      </Link>
    </div>
  );
}
