import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PropertySummaryBadges } from "@/components/listings/property-summary-badges";
import { SwipeCardShell, SwipeOverlay } from "@/components/listings/swipe-card";
import {
  useSwipeGesture,
  type SwipeDirection,
} from "@/hooks/use-swipe-gesture";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function BrowsePropertyCard({
  property,
  disabled,
  exitDirection,
  onLike,
  onDislike,
  onPass,
}: {
  property: Property;
  disabled?: boolean;
  exitDirection?: SwipeDirection | null;
  onLike: () => void;
  onDislike: () => void;
  onPass: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const summary = buildPropertySummary(property);
  const swipe = useSwipeGesture({
    disabled: disabled || Boolean(exitDirection),
    onSwipe: (direction) => {
      if (direction === "right") onLike();
      if (direction === "left") onDislike();
      if (direction === "up") onPass();
    },
  });

  return (
    <SwipeCardShell
      className={cn(
        "mx-auto w-full max-w-md",
        exitDirection === "left" && "browse-card-exit-left",
        exitDirection === "right" && "browse-card-exit-right",
        exitDirection === "up" && "browse-card-exit-up"
      )}
      style={exitDirection ? undefined : swipe.style}
      bind={swipe.bind}
    >
      <SwipeOverlay hint={swipe.hint} />
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        {property.imageUrl && !imageFailed ? (
          <img
            src={property.imageUrl}
            alt={summary.title}
            className="aspect-[4/5] w-full object-cover"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex aspect-[4/5] w-full items-center justify-center bg-muted text-muted-foreground">
            {m.property_no_photo()}
          </div>
        )}
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
    </SwipeCardShell>
  );
}

export function BrowsePropertyCardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-lg">
      <div className="aspect-[4/5] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
