import { useCallback, useState } from 'react';
import type { SortDir } from '../components/SortTh';

export function useSortableTable<K extends string>() {
  const [sortKey, setSortKey] = useState<K | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = useCallback(
    (key: K) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey]
  );

  return { sortKey, sortDir, toggleSort };
}

export function cmpStr(a?: string | null, b?: string | null) {
  return (a || '').localeCompare(b || '', 'pt-BR', { sensitivity: 'base' });
}

export function cmpNum(a: number, b: number) {
  return a - b;
}

export function sortRows<T>(
  items: T[],
  sortKey: string | null,
  sortDir: SortDir,
  compare: (a: T, b: T, key: string) => number
): T[] {
  if (!sortKey) return items;
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => compare(a, b, sortKey) * dir);
}

export function countBy<T, K extends string>(
  items: T[],
  options: { id: K; match: (item: T) => boolean }[]
): Record<K, number> {
  const counts = {} as Record<K, number>;
  options.forEach((opt) => {
    counts[opt.id] = opt.id === ('all' as K) ? items.length : 0;
  });
  if ('all' in counts) {
    counts['all' as K] = items.length;
  }
  options.forEach((opt) => {
    if (opt.id === ('all' as K)) return;
    counts[opt.id] = items.filter(opt.match).length;
  });
  return counts;
}
