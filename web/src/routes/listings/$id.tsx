import { createFileRoute } from "@tanstack/react-router";
import {
  DetailsSectionSkeleton,
  ListingDetailSkeleton,
} from "@/components/listings/listing-detail-skeleton";
import { CompatibilityDetailPanel } from "@/components/listings/compatibility-detail";
import { PropertyAdemeSection } from "@/components/listings/detail/property-ademe-section";
import { PropertyDetailsSection } from "@/components/listings/detail/property-details-section";
import { DetailReactionBar } from "@/components/listings/browse-review-actions";
import { PropertyHero } from "@/components/listings/property-hero";
import { PropertyReactionActions } from "@/components/listings/property-reactions";
import { Alert } from "@/components/ui/alert";
import { usePropertyDetail } from "@/hooks/use-property-detail";
import { usePropertyReactions } from "@/hooks/use-property-reactions";
import { getErrorMessage } from "@/lib/error-message";
import type { Property } from "@find-my-house/api-types";
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
    return <Alert variant="destructive">{m.listing_detail_invalid_id()}</Alert>;
  }

  if (detail.listingQuery.isPending) {
    return <ListingDetailSkeleton />;
  }

  if (detail.listingQuery.error && !detail.listingQuery.data) {
    return (
      <Alert variant="destructive">
        {getErrorMessage(detail.listingQuery.error)}
      </Alert>
    );
  }

  if (!detail.property) {
    return <Alert>{m.listing_detail_not_found()}</Alert>;
  }

  return (
    <ListingDetailContent
      property={detail.property}
      detail={detail}
      listingError={detail.listingQuery.error}
    />
  );
}

function ListingDetailContent({
  property,
  detail,
  listingError,
}: {
  property: Property;
  detail: ReturnType<typeof usePropertyDetail>;
  listingError: Error | null;
}) {
  const reactions = usePropertyReactions(property);

  return (
    <div className="-mx-4 space-y-6 pb-24 md:mx-0 md:pb-6">
      {detail.isRefreshingDetails ? (
        <p className="px-4 text-sm text-muted-foreground md:px-0">
          {m.listing_detail_loading()}
        </p>
      ) : null}
      {listingError ? (
        <Alert variant="destructive" className="mx-4 md:mx-0">
          {getErrorMessage(listingError)}
        </Alert>
      ) : null}

      <div className="px-4 md:px-0">
        <PropertyHero
          property={property}
          imageSkeleton={detail.isRefreshingDetails}
        />
      </div>

      <DetailReactionBar>
        <PropertyReactionActions property={property} reactions={reactions} />
      </DetailReactionBar>

      {property.compatibility ? (
        <div className="px-4 md:px-0">
          <CompatibilityDetailPanel compatibility={property.compatibility} />
        </div>
      ) : null}
      <div className="px-4 md:px-0">
        {detail.isRefreshingDetails ? (
          <DetailsSectionSkeleton />
        ) : (
          <PropertyDetailsSection property={property} />
        )}
        <PropertyAdemeSection
          addressQuery={detail.addressQuery}
          confirmAddressMutation={detail.confirmAddressMutation}
        />
      </div>
    </div>
  );
}
