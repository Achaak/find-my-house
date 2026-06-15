import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function ListingDetailSkeleton() {
  return (
    <div className="space-y-6">
      <ListingCardSkeleton />
      <DetailsSectionSkeleton />
      <AddressSectionSkeleton />
    </div>
  );
}

export function ListingCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Bone className="h-52 w-full rounded-none" />
      <CardHeader className="space-y-3">
        <div className="flex gap-2">
          <Bone className="h-5 w-12" />
          <Bone className="h-5 w-20" />
        </div>
        <Bone className="h-6 w-3/4" />
        <Bone className="h-4 w-1/3" />
      </CardHeader>
      <CardContent className="space-y-2">
        <Bone className="h-8 w-32" />
        <Bone className="h-4 w-48" />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <Bone className="h-9 w-20" />
        <Bone className="h-9 w-16" />
        <Bone className="h-9 w-20" />
      </CardFooter>
    </Card>
  );
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
