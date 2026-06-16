import type { UseQueryResult } from "@tanstack/react-query";
import { PropertyCard } from "@/components/listings/property-card";
import { getErrorMessage } from "@/lib/error-message";
import type { Property } from "@find-my-house/api-types";

export function ReactionListPage({
  title,
  description,
  query,
}: {
  title: string;
  description: string;
  query: UseQueryResult<{ items: Property[] }>;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {query.isLoading ? <p>Loading…</p> : null}
      {query.error ? (
        <p className="text-destructive">{getErrorMessage(query.error)}</p>
      ) : null}
      {query.data?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.items.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : query.data ? (
        <p className="text-muted-foreground">No listings yet.</p>
      ) : null}
    </div>
  );
}
