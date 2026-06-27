import type { UseQueryResult } from "@tanstack/react-query";
import {
  PropertyGridCard,
  PropertyGridCardSkeleton,
} from "@/components/listings/property-grid-card";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { getErrorMessage } from "@/lib/error-message";
import type { Property } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

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
      {query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PropertyGridCardSkeleton />
          <PropertyGridCardSkeleton />
        </div>
      ) : null}
      {query.error ? (
        <Alert variant="destructive">{getErrorMessage(query.error)}</Alert>
      ) : null}
      {query.data?.items.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {query.data.items.map((property) => (
            <PropertyGridCard key={property.id} property={property} />
          ))}
        </div>
      ) : query.data ? (
        <EmptyState
          title={m.reactions_empty()}
          action={{ label: m.home_go_listings(), to: "/listings" }}
        />
      ) : null}
    </div>
  );
}
