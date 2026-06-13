import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { PropertyCard } from "@/components/listings/property-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { formatPrice, formatSource } from "@/lib/utils";

export const Route = createFileRoute("/listings/$id")({
  component: ListingDetailPage,
});

function ListingDetailPage() {
  const { id } = Route.useParams();
  const propertyId = Number.parseInt(id, 10);

  const listingQuery = useQuery({
    queryKey: queryKeys.listing(propertyId),
    queryFn: () => api.listing(propertyId),
    enabled: Number.isInteger(propertyId),
  });

  const addressQuery = useQuery({
    queryKey: queryKeys.address(propertyId),
    queryFn: () => api.addressSearch(propertyId),
    enabled: Number.isInteger(propertyId),
  });

  if (!Number.isInteger(propertyId)) {
    return <p>Invalid listing id.</p>;
  }

  if (listingQuery.isLoading) return <p>Loading…</p>;
  if (listingQuery.error) {
    return (
      <p className="text-destructive">
        {(listingQuery.error as Error).message}
      </p>
    );
  }

  if (!listingQuery.data) {
    return <p>Listing not found.</p>;
  }

  const property = listingQuery.data.item;

  return (
    <div className="space-y-6">
      <PropertyCard property={property} />
      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Details</h2>
        <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
          <Detail label="Address" value={property.address ?? "Unknown"} />
          <Detail label="DPE" value={property.dpeClass ?? "—"} />
          <Detail label="GES" value={property.gesClass ?? "—"} />
          <Detail label="Heating" value={property.heating ?? "—"} />
          <Detail label="Orientation" value={property.orientation ?? "—"} />
          <Detail label="Condition" value={property.propertyCondition ?? "—"} />
          <Detail
            label="First price"
            value={formatPrice(property.firstPrice)}
          />
          <Detail
            label="First seen"
            value={new Date(property.firstSeenAt).toLocaleString("fr-FR")}
          />
        </dl>
        {property.description ? (
          <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
            {property.description}
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {property.publications.map((publication) => (
            <Badge key={publication.id} variant="outline">
              {formatSource(publication.source)}
            </Badge>
          ))}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Address via ADEME DPE</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Same workflow as <code>/address</code> on Discord.
        </p>
        {addressQuery.isLoading ? (
          <p className="mt-4">Searching ADEME…</p>
        ) : null}
        {addressQuery.data?.warnings.length ? (
          <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
            {addressQuery.data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {addressQuery.data?.candidates.length ? (
          <div className="mt-4 space-y-3">
            {addressQuery.data.candidates.map((candidate) => (
              <div
                key={candidate.numeroDpe}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <div className="font-medium">{candidate.address}</div>
                  <div className="text-xs text-muted-foreground">
                    DPE {candidate.numeroDpe} · score{" "}
                    {Math.round(candidate.score)}
                  </div>
                </div>
                <ConfirmAddressButton
                  propertyId={propertyId}
                  numeroDpe={candidate.numeroDpe}
                />
              </div>
            ))}
          </div>
        ) : addressQuery.data ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No DPE candidates found.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function ConfirmAddressButton({
  propertyId,
  numeroDpe,
}: {
  propertyId: number;
  numeroDpe: string;
}) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.addressConfirm(propertyId, numeroDpe),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.listing(propertyId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.address(propertyId),
      });
    },
  });

  return (
    <Button
      type="button"
      size="sm"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? "Saving…" : "Confirm"}
    </Button>
  );
}
