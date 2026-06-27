import { Link } from "@tanstack/react-router";
import { PropertyPhotoCarousel } from "@/components/listings/property-photo-carousel";
import { PropertySummaryBadges } from "@/components/listings/property-summary-badges";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export type BrowseExitDirection = "left" | "right" | "up";

export function BrowsePropertyCard({
  property,
  exitDirection,
}: {
  property: Property;
  exitDirection?: BrowseExitDirection | null;
}) {
  const summary = buildPropertySummary(property);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-md",
        exitDirection === "left" && "browse-card-exit-left",
        exitDirection === "right" && "browse-card-exit-right",
        exitDirection === "up" && "browse-card-exit-up"
      )}
    >
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        <PropertyPhotoCarousel photos={property.photos} alt={summary.title} />
        <div className="space-y-2 p-4">
          <PropertySummaryBadges property={property} badges={summary.badges} />
          <h2 className="line-clamp-2 text-lg font-semibold">
            {summary.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {summary.locationLine}
          </p>
          <div className="text-2xl font-semibold">
            {formatPrice(summary.price)}
          </div>
          {summary.specsLine ? (
            <p className="text-sm text-muted-foreground">{summary.specsLine}</p>
          ) : null}
          <Link
            to="/listings/$id"
            params={{ id: String(property.id) }}
            className="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {m.browse_view_detail()}
          </Link>
        </div>
      </div>
    </div>
  );
}

export function BrowsePropertyCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-lg">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
