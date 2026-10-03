import { Skeleton } from "@/components/ui/skeleton";

export function DashboardRouteLoading({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-8 animate-pulse">
      <div>
        <Skeleton className="h-9 w-56 max-w-full mb-2" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
