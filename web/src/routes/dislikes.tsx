import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PropertyCard } from "@/components/listings/property-card";
import { api, queryKeys } from "@/lib/api";

export const Route = createFileRoute("/dislikes")({
  component: DislikesPage,
});

function DislikesPage() {
  const query = useQuery({
    queryKey: queryKeys.reactions("dislike"),
    queryFn: () => api.reactions("dislike"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dislikes</h1>
        <p className="text-sm text-muted-foreground">
          Listings you disliked — same as /dislike list on Discord.
        </p>
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
        <p className="text-muted-foreground">No dislikes yet.</p>
      ) : null}
    </div>
  );
}
