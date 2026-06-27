import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { CompatibilityBadge } from "@/components/listings/compatibility-badge";
import { PropertyReactionActions } from "@/components/listings/property-reactions";
import { Badge } from "@/components/ui/badge";
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
import { PropertyImageSkeleton } from "@/components/listings/listing-detail-skeleton";
import { PropertyPortalLinks } from "@/components/listings/property-portal-links";
import { cn, formatPrice, formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

const propertyCardImageClass = "aspect-video w-full";

export function PropertyCard({
  property,
  selected = false,
  imageSkeleton = false,
  hideReactions = false,
  onSelect,
}: {
  property: Property;
  selected?: boolean;
  imageSkeleton?: boolean;
  hideReactions?: boolean;
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
      <Card className="overflow-hidden">
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
                  propertyCardImageClass,
                  "object-cover transition-opacity hover:opacity-95"
                )}
              />
            ) : (
              <div
                className={cn(
                  propertyCardImageClass,
                  "flex items-center justify-center bg-muted text-sm text-muted-foreground transition-colors hover:bg-muted/80"
                )}
              >
                {m.property_no_photo()}
              </div>
            )}
          </Link>
        )}
        <CardHeader>
          <div className="flex flex-wrap items-start gap-2">
            {summary.badges.map((badge) => {
              switch (badge.kind) {
                case "id":
                  return (
                    <Badge key="id" variant="secondary">
                      #{badge.id}
                    </Badge>
                  );
                case "source":
                  return (
                    <Badge key={badge.source} variant="outline">
                      {formatSource(badge.source)}
                    </Badge>
                  );
                case "publications-unavailable":
                  return (
                    <Badge key="unavailable" variant="outline">
                      {m.publications_unavailable_badge()}
                    </Badge>
                  );
                case "compatibility":
                  return property.compatibility ? (
                    <CompatibilityBadge
                      key="compat"
                      compatibility={property.compatibility}
                    />
                  ) : null;
                case "price-drop":
                  return (
                    <Badge
                      key="price-drop"
                      variant="default"
                      className="bg-emerald-600"
                    >
                      {badge.label}
                    </Badge>
                  );
                default:
                  return null;
              }
            })}
          </div>
          <CardTitle className="line-clamp-2">{summary.title}</CardTitle>
          <CardDescription>{summary.locationLine}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="text-2xl font-semibold">
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
      </Card>
    </div>
  );
}
