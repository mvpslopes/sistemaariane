import { CLIENT_MODULES, clientModuleLabel } from '../constants/clientModules';
import type { MyModulesPayload } from '../services/apiService';

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
      {!activeSet.size && data.modules.length === 0 && (
        <p className="mt-3 text-xs text-brand-olive">
          Módulos serão exibidos quando configurados pela assessoria em Assinaturas SaaS.
        </p>
      )}
    </section>
  );
}
