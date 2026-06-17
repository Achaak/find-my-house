import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import {
  DetailsSectionSkeleton,
  ListingDetailSkeleton,
} from "@/components/listings/listing-detail-skeleton";
import { CompatibilityDetailPanel } from "@/components/listings/compatibility-detail";
import { PropertyCard } from "@/components/listings/property-card";
import { PropertyPortalLinks } from "@/components/listings/property-portal-links";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { findCachedListing } from "@/lib/listing-cache";
import { formatLocaleDateTime } from "@/lib/locale";
import { googleMapsSearchUrl } from "@/lib/map-utils";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

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
    return <p>{m.listing_detail_invalid_id()}</p>;
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
    return <p>{m.listing_detail_not_found()}</p>;
  }

  const property = listingQuery.data.item;
  const isEnrichmentPending = listingQuery.data.enrichment.status === "pending";
  const isRefreshingDetails =
    isEnrichmentPending ||
    (listingQuery.isFetching && listingQuery.isPlaceholderData);

  return (
    <div className="space-y-6">
      {isRefreshingDetails ? (
        <p className="text-sm text-muted-foreground">
          {m.listing_detail_loading()}
        </p>
      ) : null}
      {listingQuery.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(listingQuery.error)}
        </p>
      ) : null}
      <PropertyCard property={property} imageSkeleton={isRefreshingDetails} />
      {property.compatibility ? (
        <CompatibilityDetailPanel compatibility={property.compatibility} />
      ) : null}
      {isRefreshingDetails ? (
        <DetailsSectionSkeleton />
      ) : (
        <PropertyDetailsSection property={property} />
      )}

      <section className="rounded-xl border bg-card p-6">
        <h2 className="text-lg font-semibold">
          {m.listing_detail_ademe_title()}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {m.listing_detail_ademe_desc()}
        </p>
        {addressQuery.isLoading ||
        addressQuery.data?.enrichment.status === "pending" ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {addressQuery.data?.enrichment.status === "pending"
              ? m.listing_detail_ademe_enriching()
              : m.listing_detail_ademe_searching()}
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
                    {m.listing_detail_dpe_score({
                      numero: candidate.numeroDpe,
                      score: Number.isFinite(candidate.score)
                        ? Math.round(candidate.score)
                        : m.common_em_dash(),
                    })}
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
                    {m.listing_detail_google_maps()}
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
            {m.listing_detail_ademe_empty()}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function PropertyDetailsSection({ property }: { property: Property }) {
  const emDash = m.common_em_dash();

  return (
    <section className="rounded-xl border bg-card p-6">
      <h2 className="text-lg font-semibold">
        {m.listing_detail_details_title()}
      </h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <Detail
          label={m.detail_address()}
          value={property.address ?? m.common_unknown()}
        />
        <Detail
          label={m.detail_type()}
          value={property.propertyType ?? emDash}
        />
        <Detail
          label={m.detail_price_per_m2()}
          value={
            property.surface
              ? formatPrice(Math.round(property.price / property.surface))
              : emDash
          }
        />
        <Detail label={m.detail_dpe()} value={property.dpeClass ?? emDash} />
        <Detail label={m.detail_ges()} value={property.gesClass ?? emDash} />
        <Detail
          label={m.detail_dpe_consumption()}
          value={
            property.dpeConsumptionKwhM2
              ? `${String(property.dpeConsumptionKwhM2)} ${m.unit_kwh_m2()}`
              : emDash
          }
        />
        <Detail
          label={m.detail_ges_emissions()}
          value={
            property.gesEmissionKgM2
              ? `${String(property.gesEmissionKgM2)} ${m.unit_kg_co2_m2()}`
              : emDash
          }
        />
        <Detail
          label={m.detail_bathrooms()}
          value={property.bathrooms ? String(property.bathrooms) : emDash}
        />
        <Detail
          label={m.detail_construction_year()}
          value={
            property.constructionYear
              ? String(property.constructionYear)
              : emDash
          }
        />
        <Detail label={m.detail_heating()} value={property.heating ?? emDash} />
        <Detail
          label={m.detail_orientation()}
          value={property.orientation ?? emDash}
        />
        <Detail
          label={m.detail_condition()}
          value={property.propertyCondition ?? emDash}
        />
        <Detail
          label={m.detail_parking()}
          value={
            property.parkingSpaces ? String(property.parkingSpaces) : emDash
          }
        />
        <Detail
          label={m.detail_first_price()}
          value={formatPrice(property.firstPrice)}
        />
        <Detail
          label={m.detail_first_seen()}
          value={formatLocaleDateTime(property.firstSeenAt)}
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
      <div className="mt-4">
        <PropertyPortalLinks property={property} variant="badge" />
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
        {mutation.isPending ? m.common_saving() : m.listing_detail_confirm()}
      </Button>
      {mutation.isSuccess ? (
        <span className="text-xs text-muted-foreground">
          {m.listing_detail_address_saved({
            numero: mutation.data.dpeNumero,
          })}
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
