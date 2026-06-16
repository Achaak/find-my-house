import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import {
  DetailsSectionSkeleton,
  ListingDetailSkeleton,
} from "@/components/listings/listing-detail-skeleton";
import { PropertyCard } from "@/components/listings/property-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { findCachedListing } from "@/lib/listing-cache";
import { googleMapsSearchUrl } from "@/lib/map-utils";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice, formatSource } from "@/lib/utils";

export const Route = createFileRoute("/listings/$id")({
  component: ListingDetailPage,
});

function parseListingId(id: string): number | null {
  const propertyId = Number(id);
  if (!Number.isInteger(propertyId) || String(propertyId) !== id) {
    return null;
  }
  return propertyId;
}

function ListingDetailPage() {
  const { id } = Route.useParams();
  const propertyId = parseListingId(id);
  const queryClient = useQueryClient();
  const cachedProperty =
    propertyId !== null
      ? findCachedListing(queryClient, propertyId)
      : undefined;

  const listingQuery = useQuery({
    queryKey: queryKeys.listing(propertyId ?? 0),
    queryFn: () => api.listing(propertyId!),
    enabled: propertyId !== null,
    placeholderData: cachedProperty
      ? { item: cachedProperty, enrichment: { status: "pending" as const } }
      : undefined,
    refetchInterval: (query) =>
      query.state.data?.enrichment.status === "pending" ? 3_000 : false,
  });

  const addressQuery = useQuery({
    queryKey: queryKeys.address(propertyId ?? 0),
    queryFn: () => api.addressSearch(propertyId!),
    enabled: propertyId !== null,
    refetchInterval: (query) =>
      query.state.data?.enrichment.status === "pending" ? 3_000 : false,
  });

  if (propertyId === null) {
    return <p>Invalid listing id.</p>;
  }

  if (listingQuery.isPending) {
    return <ListingDetailSkeleton />;
  }

  if (listingQuery.error && !listingQuery.data) {
    return (
      <p className="text-destructive">{getErrorMessage(listingQuery.error)}</p>
    );
  }

  if (!listingQuery.data) {
    return <p>Listing not found.</p>;
  }

  const property = listingQuery.data.item;
  const isEnrichmentPending = listingQuery.data.enrichment.status === "pending";
  const isRefreshingDetails =
    isEnrichmentPending ||
    (listingQuery.isFetching && listingQuery.isPlaceholderData);

  return (
    <div className="space-y-6">
      {isRefreshingDetails ? (
        <p className="text-sm text-muted-foreground">Loading full details…</p>
      ) : null}
      {listingQuery.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(listingQuery.error)}
        </p>
      ) : null}
      <PropertyCard property={property} imageSkeleton={isRefreshingDetails} />
      {isRefreshingDetails ? (
        <DetailsSectionSkeleton />
      ) : (
        <PropertyDetailsSection property={property} />
      )}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Address via ADEME DPE</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Check each candidate on Google Maps, then confirm the property address
          using ADEME DPE data.
        </p>
        {addressQuery.isLoading ||
        addressQuery.data?.enrichment.status === "pending" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {addressQuery.data?.enrichment.status === "pending"
              ? "Enriching listing data before ADEME search…"
              : "Searching ADEME…"}
          </p>
        ) : null}
        {addressQuery.error ? (
          <p className="mt-4 text-sm text-destructive">
            {getErrorMessage(addressQuery.error)}
          </p>
        ) : null}
        {addressQuery.data?.error ? (
          <p className="mt-4 text-sm text-destructive">
            {addressQuery.data.error}
          </p>
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
                    {Number.isFinite(candidate.score)
                      ? Math.round(candidate.score)
                      : "—"}
                  </div>
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  <a
                    href={googleMapsSearchUrl({
                      address: candidate.address,
                      latitude: candidate.latitude,
                      longitude: candidate.longitude,
                    })}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <MapPin className="size-4" />
                    Google Maps
                  </a>
                  <ConfirmAddressButton
                    propertyId={propertyId}
                    numeroDpe={candidate.numeroDpe}
                  />
                </div>
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

function PropertyDetailsSection({ property }: { property: Property }) {
  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">Details</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Detail label="Address" value={property.address ?? "Unknown"} />
        <Detail label="Type" value={property.propertyType ?? "—"} />
        <Detail
          label="Price per m²"
          value={
            property.surface
              ? formatPrice(Math.round(property.price / property.surface))
              : "—"
          }
        />
        <Detail label="DPE" value={property.dpeClass ?? "—"} />
        <Detail label="GES" value={property.gesClass ?? "—"} />
        <Detail
          label="DPE consumption"
          value={
            property.dpeConsumptionKwhM2
              ? `${String(property.dpeConsumptionKwhM2)} kWh/m²`
              : "—"
          }
        />
        <Detail
          label="GES emissions"
          value={
            property.gesEmissionKgM2
              ? `${String(property.gesEmissionKgM2)} kg CO₂/m²`
              : "—"
          }
        />
        <Detail
          label="Bathrooms"
          value={property.bathrooms ? String(property.bathrooms) : "—"}
        />
        <Detail
          label="Construction year"
          value={
            property.constructionYear ? String(property.constructionYear) : "—"
          }
        />
        <Detail label="Heating" value={property.heating ?? "—"} />
        <Detail label="Orientation" value={property.orientation ?? "—"} />
        <Detail label="Condition" value={property.propertyCondition ?? "—"} />
        <Detail
          label="Parking"
          value={property.parkingSpaces ? String(property.parkingSpaces) : "—"}
        />
        <Detail label="First price" value={formatPrice(property.firstPrice)} />
        <Detail
          label="First seen"
          value={new Date(property.firstSeenAt).toLocaleString("fr-FR")}
        />
      </dl>
      {property.highlights?.length ? (
        <ul className="mt-4 list-disc pl-5 text-sm text-muted-foreground">
          {property.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
      ) : null}
      {property.description ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">
          {property.description}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {property.publications.map((publication) => (
          <a
            key={publication.id}
            href={publication.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            <Badge variant={publication.isActive ? "outline" : "secondary"}>
              {formatSource(publication.source)}
              {!publication.isActive ? " (inactive)" : ""}
            </Badge>
          </a>
        ))}
      </div>
    </section>
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
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? "Saving…" : "Confirm"}
      </Button>
      {mutation.isSuccess ? (
        <span className="text-xs text-muted-foreground">
          Address saved for DPE {mutation.data.dpeNumero}
        </span>
      ) : null}
      {mutation.error ? (
        <span className="text-xs text-destructive">
          {getErrorMessage(mutation.error)}
        </span>
      ) : null}
    </div>
  );
}
