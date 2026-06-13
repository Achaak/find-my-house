import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PropertyCard } from "@/components/listings/property-card";
import { api, queryKeys } from "@/lib/api";

export const Route = createFileRoute("/favorites")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const query = useQuery({
    queryKey: queryKeys.reactions("like"),
    queryFn: () => api.reactions("like"),
  });

  return (
    <ReactionListPage
      title="Favorites"
      description="Listings you liked — same as /like list on Discord."
      query={query}
    />
  );
}

function ReactionListPage({
  title,
  description,
  query,
}: {
  title: string;
  description: string;
  query: ReturnType<
    typeof useQuery<{ items: import("@/lib/types").Property[] }>
  >;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {query.isLoading ? <p>Loading…</p> : null}
      {query.error ? (
        <p className="text-destructive">{(query.error as Error).message}</p>
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
