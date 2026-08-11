import type { ReactNode } from 'react';

export function ListTableToolbar({
  search,
  filters,
}: {
  search: ReactNode;
  filters?: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-olive/70">
        Busca e filtros
      </p>
      {search}
      {filters}
      <p className="text-[11px] text-brand-olive/75">
        Use os botões para filtrar · Clique nos cabeçalhos da tabela para ordenar
      </p>
    </div>
  );
}
