import { CLIENT_MODULES, clientModuleLabel, HARAS_CLIENT_MODULE_LINKS } from '../constants/clientModules';
import type { MyModulesPayload } from '../services/apiService';
import { Link } from 'react-router-dom';

export default function ClientModulesPanel({ data }: { data: MyModulesPayload }) {
  const activeSet = new Set((data.modules || []).filter((m) => m.active).map((m) => m.code));

  return (
    <section className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-brand-dark-brown">Seu plano · módulos do haras</h3>
        {data.subscriptionSuspended ? (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            Assinatura suspensa
          </span>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            {data.subscriptionType === 'avulso' ? 'Cliente avulso' : 'Cliente assessoria'}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {CLIENT_MODULES.map(({ code, label }) => {
          const on = activeSet.has(code);
          return (
            <span
              key={code}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                on
                  ? 'bg-brand-forest/15 text-brand-forest'
                  : 'bg-brand-off-white text-brand-olive/60 line-through decoration-brand-olive/40'
              }`}
              title={clientModuleLabel(code)}
            >
              {on ? '✓ ' : ''}
              {label}
            </span>
          );
        })}
      </div>
      {HARAS_CLIENT_MODULE_LINKS.some((l) => activeSet.has(l.code)) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {HARAS_CLIENT_MODULE_LINKS.filter((l) => activeSet.has(l.code)).map((l) => (
            <Link
              key={l.code}
              to={l.to}
              className="rounded-xl border border-brand-beige bg-white px-3 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-off-white"
            >
              Abrir {l.label.toLowerCase()}
            </Link>
          ))}
        </div>
      )}
      {!activeSet.size && data.modules.length === 0 && (
        <p className="mt-3 text-xs text-brand-olive">
          Módulos serão exibidos quando configurados pela assessoria em Assinaturas SaaS.
        </p>
      )}
    </section>
  );
}
