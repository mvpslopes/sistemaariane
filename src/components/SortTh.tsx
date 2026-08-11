import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

export type SortDir = 'asc' | 'desc';

export function SortTh<K extends string>({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: K;
  sortKey: K | null;
  sortDir: SortDir;
  onSort: (key: K) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const SortIcon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;

  return (
    <th className={`px-4 py-3 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 rounded-lg px-1 py-0.5 transition hover:text-brand-dark-brown ${
          active ? 'text-brand-dark-brown' : 'text-brand-olive'
        }`}
        title={`Ordenar por ${label}`}
      >
        {label}
        <SortIcon className={`h-3.5 w-3.5 shrink-0 ${active ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}
