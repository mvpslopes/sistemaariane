import { Skeleton } from '../Skeleton';

interface ListPageSkeletonProps {
  variant?: 'table' | 'cards';
  rows?: number;
  columns?: number;
}

export default function ListPageSkeleton({
  variant = 'table',
  rows = 6,
  columns = 5,
}: ListPageSkeletonProps) {
  if (variant === 'cards') {
    return (
      <ul className="space-y-3" aria-busy="true" aria-label="Carregando listagem">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i}>
            <div className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
              <div className="flex items-start gap-3">
                <Skeleton className="h-14 w-14 shrink-0" rounded="xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-brand-beige bg-white shadow-card"
      aria-busy="true"
      aria-label="Carregando listagem"
    >
      <div className="hidden border-b border-brand-beige/60 px-4 py-3 sm:block">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-brand-beige/50">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2 sm:hidden" />
            </div>
            <Skeleton className="hidden h-3 w-24 sm:block" />
            <Skeleton className="hidden h-6 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-8 w-16 sm:block" rounded="lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
