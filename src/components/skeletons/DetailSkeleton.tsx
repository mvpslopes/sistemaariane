import { Skeleton } from '../Skeleton';

export default function DetailSkeleton() {
  return (
    <div className="space-y-4 py-2" aria-busy="true" aria-label="Carregando detalhes">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-20" rounded="xl" />
        <Skeleton className="h-20" rounded="xl" />
      </div>
      <Skeleton className="h-32" rounded="xl" />
    </div>
  );
}
