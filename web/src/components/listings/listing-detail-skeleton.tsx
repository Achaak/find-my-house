import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function ListingDetailSkeleton() {
  return (
    <div className="space-y-6">
      <PropertyHeroSkeleton />
      <DetailsSectionSkeleton />
      <AddressSectionSkeleton />
    </div>
  );
}

export function PropertyImageSkeleton() {
  return (
    <Bone className="aspect-[16/10] w-full rounded-none md:aspect-[21/9]" />
  );
}

export function PropertyHeroSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <PropertyImageSkeleton />
      <div className="space-y-3 p-4 md:hidden">
        <div className="flex gap-2">
          <Bone className="h-5 w-12" />
          <Bone className="h-5 w-20" />
        </div>
        <Bone className="h-7 w-3/4" />
        <Bone className="h-4 w-1/2" />
        <Bone className="h-9 w-36" />
        <Bone className="h-4 w-48" />
      </div>
    </div>
  );
}

export function ListingCardSkeleton() {
  return <PropertyHeroSkeleton />;
}

export function DetailsSectionSkeleton() {
  return (
    <section className="rounded-xl border bg-card p-6">
      <Bone className="h-6 w-24" />
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 12 }, (_, index) => (
          <div key={index} className="space-y-2">
            <Bone className="h-3 w-24" />
            <Bone className="h-4 w-32" />
          </div>
        ))}
      </dl>
    </section>
  );
}

export function AddressSectionSkeleton() {
  return (
    <section className="rounded-xl border bg-card p-6">
      <Bone className="h-6 w-44" />
      <Bone className="mt-2 h-4 w-full max-w-xl" />
      <Bone className="mt-4 h-4 w-40" />
    </section>
  );
}
