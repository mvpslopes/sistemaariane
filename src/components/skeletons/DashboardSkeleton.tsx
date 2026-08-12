import { Skeleton } from '../Skeleton';

interface DashboardSkeletonProps {
  mobile?: boolean;
}

export default function DashboardSkeleton({ mobile = false }: DashboardSkeletonProps) {
  if (mobile) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Carregando painel">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" rounded="lg" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-brand-beige bg-white p-4 shadow-card">
              <Skeleton className="mb-3 h-9 w-9" rounded="xl" />
              <Skeleton className="mb-2 h-7 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-brand-beige bg-white p-3">
              <Skeleton className="h-10 w-10" rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-busy="true" aria-label="Carregando painel">
      <div className="space-y-2">
        <Skeleton className="h-8 w-72" rounded="lg" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-beige bg-white p-5 shadow-card">
            <Skeleton className="mb-4 h-10 w-10" rounded="xl" />
            <Skeleton className="mb-2 h-8 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-brand-beige bg-white p-5 shadow-card">
            <Skeleton className="mb-4 h-4 w-32" />
            <Skeleton className="mx-auto h-36 w-36" rounded="full" />
          </div>
        ))}
      </div>
    </div>
  );
}
