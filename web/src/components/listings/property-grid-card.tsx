import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PropertyReactionActions } from "@/components/listings/property-reactions";
import { PropertySummaryBadges } from "@/components/listings/property-summary-badges";
import { PropertyPortalLinks } from "@/components/listings/property-portal-links";
import { PropertyImageSkeleton } from "@/components/listings/listing-detail-skeleton";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { usePropertyReactions } from "@/hooks/use-property-reactions";
import { getErrorMessage } from "@/lib/error-message";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

const imageClass = "aspect-[4/3] w-full";

export function PropertyGridCard({
  property,
  selected = false,
  imageSkeleton = false,
  hideReactions = false,
  compact = false,
  onSelect,
}: {
  property: Property;
  selected?: boolean;
  imageSkeleton?: boolean;
  hideReactions?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const reactions = usePropertyReactions(property);
  const summary = buildPropertySummary(property);
  const imageAlt = m.property_image_alt({
    title: property.title,
    city: property.city,
  });

  return (
    <div
      id={`listing-card-${String(property.id)}`}
      className={cn(
        "rounded-xl transition-shadow",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        onSelect && "cursor-pointer"
      )}
      onClick={(event) => {
        if (!onSelect) return;
        const target = event.target as HTMLElement;
        if (target.closest("a, button")) return;
        onSelect();
      }}
      onKeyDown={(event) => {
        if (!onSelect) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
    >
      <Card className="overflow-hidden border-border/80 shadow-sm">
        {imageSkeleton ? (
          <PropertyImageSkeleton />
        ) : (
          <Link
            to="/listings/$id"
            params={{ id: String(property.id) }}
            aria-label={m.property_details()}
            className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {property.imageUrl && !imageFailed ? (
              <img
                src={property.imageUrl}
                alt={imageAlt}
                loading="lazy"
                decoding="async"
                onError={() => setImageFailed(true)}
                className={cn(
                  imageClass,
                  "object-cover transition-opacity hover:opacity-95"
                )}
              />
            ) : (
              <div
                className={cn(
                  imageClass,
                  "flex items-center justify-center bg-muted text-sm text-muted-foreground"
                )}
              >
                {m.property_no_photo()}
              </div>
            )}
          </Link>
        )}
        <CardHeader className={cn(compact && "p-4 pb-2")}>
          <PropertySummaryBadges property={property} badges={summary.badges} />
          <CardTitle className={cn("line-clamp-2", compact && "text-base")}>
            {summary.title}
          </CardTitle>
          <CardDescription>{summary.locationLine}</CardDescription>
        </CardHeader>
        <CardContent
          className={cn("space-y-2 text-sm", compact && "px-4 pb-2")}
        >
          <div className="text-2xl font-semibold tracking-tight">
            {formatPrice(summary.price)}
            {summary.priceDropLabel ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                {formatPrice(summary.firstPrice)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            {summary.specs.map((spec) => (
              <span key={spec.key}>{spec.label}</span>
            ))}
          </div>
          {!hideReactions && reactions.error ? (
            <p className="text-destructive">
              {getErrorMessage(reactions.error)}
            </p>
          ) : null}
        </CardContent>
        {!compact ? (
          <CardFooter className="flex flex-wrap gap-2">
            <Link
              to="/listings/$id"
              params={{ id: String(property.id) }}
              className={cn(buttonVariants())}
            >
              {m.property_details()}
            </Link>
            {hideReactions ? null : (
              <PropertyReactionActions
                property={property}
                reactions={reactions}
              />
            )}
            <PropertyPortalLinks property={property} />
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

export function PropertyGridCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <PropertyImageSkeleton />
      <CardHeader className="space-y-3">
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
