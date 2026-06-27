import { Skeleton } from "@/components/ui/skeleton";

export function StatsChartSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-32" />
        <Skeleton className="h-[220px] w-full" />
      </div>
      <div className="rounded-xl border bg-card p-4">
        <Skeleton className="mb-3 h-4 w-40" />
        <Skeleton className="h-[220px] w-full" />
      </div>
    </div>
  );
}
