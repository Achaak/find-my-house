import { createFileRoute } from "@tanstack/react-router";
import {
  DetailsSectionSkeleton,
  ListingDetailSkeleton,
} from "@/components/listings/listing-detail-skeleton";
import { CompatibilityDetailPanel } from "@/components/listings/compatibility-detail";
import { PropertyAdemeSection } from "@/components/listings/detail/property-ademe-section";
import { PropertyDetailsSection } from "@/components/listings/detail/property-details-section";
import { PropertyCard } from "@/components/listings/property-card";
import { usePropertyDetail } from "@/hooks/use-property-detail";
import { getErrorMessage } from "@/lib/error-message";
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
  const detail = usePropertyDetail(propertyId);

  if (propertyId === null) {
    return <p>{m.listing_detail_invalid_id()}</p>;
  }

  if (detail.listingQuery.isPending) {
    return <ListingDetailSkeleton />;
  }

  if (detail.listingQuery.error && !detail.listingQuery.data) {
    return (
      <p className="text-destructive">
        {getErrorMessage(detail.listingQuery.error)}
      </p>
    );
  }

  if (!detail.property) {
    return <p>{m.listing_detail_not_found()}</p>;
  }

  return (
    <div className="space-y-6">
      {detail.isRefreshingDetails ? (
        <p className="text-sm text-muted-foreground">
          {m.listing_detail_loading()}
        </p>
      ) : null}
      {detail.listingQuery.error ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(detail.listingQuery.error)}
        </p>
      ) : null}
      <PropertyCard
        property={detail.property}
        imageSkeleton={detail.isRefreshingDetails}
      />
      {detail.property.compatibility ? (
        <CompatibilityDetailPanel
          compatibility={detail.property.compatibility}
        />
      ) : null}
      {detail.isRefreshingDetails ? (
        <DetailsSectionSkeleton />
      ) : (
        <PropertyDetailsSection property={detail.property} />
      )}
      <PropertyAdemeSection
        addressQuery={detail.addressQuery}
        confirmAddressMutation={detail.confirmAddressMutation}
      />
    </div>
  );
}
