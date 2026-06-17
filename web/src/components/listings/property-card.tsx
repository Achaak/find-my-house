import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Archive, Heart, ThumbsDown } from "lucide-react";
import { useState } from "react";
import { CompatibilityBadge } from "@/components/listings/compatibility-badge";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, queryKeys } from "@/lib/api";
import { getErrorMessage } from "@/lib/error-message";
import { formatPriceDrop } from "@/lib/price-drop";
import type { Property } from "@find-my-house/api-types";
import { PropertyImageSkeleton } from "@/components/listings/listing-detail-skeleton";
import { PropertyPortalLinks } from "@/components/listings/property-portal-links";
import { cn, formatPrice, formatSource } from "@/lib/utils";
import { getDisplayPublications } from "@/lib/publications";
import * as m from "@/paraglide/messages.js";

export function PropertyCard({
  property,
  compact = false,
  selected = false,
  imageSkeleton = false,
  hideReactions = false,
  onSelect,
}: {
  property: Property;
  compact?: boolean;
  selected?: boolean;
  imageSkeleton?: boolean;
  hideReactions?: boolean;
  onSelect?: () => void;
}) {
  const queryClient = useQueryClient();
  const [imageFailed, setImageFailed] = useState(false);
  const imageAlt = m.property_image_alt({
    title: property.title,
    city: property.city,
  });

  const invalidateProperty = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.listing(property.id),
    });
    void queryClient.invalidateQueries({ queryKey: ["listings"] });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reactions("like"),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.reactions("dislike"),
    });
  };

  const likeMutation = useMutation({
    mutationFn: () => api.addReaction("like", property.id),
    onSuccess: invalidateProperty,
  });

  const dislikeMutation = useMutation({
    mutationFn: () => api.addReaction("dislike", property.id),
    onSuccess: invalidateProperty,
  });

  const removeMutation = useMutation({
    mutationFn: (type: "like" | "dislike") =>
      api.removeReaction(type, property.id),
    onSuccess: invalidateProperty,
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      property.archived
        ? api.unarchiveLike(property.id)
        : api.archiveLike(property.id),
    onSuccess: invalidateProperty,
  });

  const isPending =
    likeMutation.isPending ||
    dislikeMutation.isPending ||
    removeMutation.isPending ||
    archiveMutation.isPending;

  const mutationError =
    likeMutation.error ??
    dislikeMutation.error ??
    removeMutation.error ??
    archiveMutation.error ??
    null;

  const portalPublications = getDisplayPublications(property);

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
          <PropertyImageSkeleton compact={compact} />
        ) : property.imageUrl && !imageFailed ? (
          <img
            src={property.imageUrl}
            alt={imageAlt}
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className={
              compact ? "h-40 w-full object-cover" : "h-52 w-full object-cover"
            }
          />
        ) : (
          <div
            className={
              compact
                ? "flex h-40 items-center justify-center bg-muted text-sm text-muted-foreground"
                : "flex h-52 items-center justify-center bg-muted text-sm text-muted-foreground"
            }
          >
            {m.property_no_photo()}
          </div>
        )}
        <CardHeader>
          <div className="flex flex-wrap items-start gap-2">
            <Badge variant="secondary">#{property.id}</Badge>
            {portalPublications.map((publication) => (
              <Badge key={publication.key} variant="outline">
                {formatSource(publication.source)}
              </Badge>
            ))}
            {property.compatibility ? (
              <CompatibilityBadge compatibility={property.compatibility} />
            ) : null}
            {formatPriceDrop(property) ? (
              <Badge variant="default" className="bg-emerald-600">
                {formatPriceDrop(property)}
              </Badge>
            ) : null}
          </div>
          <CardTitle className="line-clamp-2">{property.title}</CardTitle>
          <CardDescription>
            {property.city}
            {property.postalCode ? ` (${property.postalCode})` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="text-2xl font-semibold">
            {formatPrice(property.price)}
            {formatPriceDrop(property) ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground line-through">
                {formatPrice(property.firstPrice)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3 text-muted-foreground">
            {property.surface ? <span>{property.surface} m²</span> : null}
            {property.landSurface ? (
              <span>
                {m.property_land_surface({ surface: property.landSurface })}
              </span>
            ) : null}
            {property.rooms ? (
              <span>{m.property_rooms({ count: property.rooms })}</span>
            ) : null}
            {property.bedrooms ? (
              <span>{m.property_beds({ count: property.bedrooms })}</span>
            ) : null}
          </div>
          {mutationError ? (
            <p className="text-destructive">{getErrorMessage(mutationError)}</p>
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
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className={cn(
                  property.reaction === "like" &&
                    "border-green-600 bg-green-50 text-green-800 hover:bg-green-100 hover:text-green-900"
                )}
                aria-label={
                  property.reaction === "like" ? m.aria_unlike() : m.aria_like()
                }
                onClick={() =>
                  property.reaction === "like"
                    ? removeMutation.mutate("like")
                    : likeMutation.mutate()
                }
              >
                <Heart
                  className={cn(
                    "size-4",
                    property.reaction === "like" && "fill-current"
                  )}
                />
                {property.reaction === "like"
                  ? m.reaction_unlike()
                  : m.reaction_like()}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={isPending}
                className={cn(
                  property.reaction === "dislike" &&
                    "border-gray-500 bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-800"
                )}
                aria-label={
                  property.reaction === "dislike"
                    ? m.aria_remove_dislike()
                    : m.aria_dislike()
                }
                onClick={() =>
                  property.reaction === "dislike"
                    ? removeMutation.mutate("dislike")
                    : dislikeMutation.mutate()
                }
              >
                <ThumbsDown className="size-4" />
                {property.reaction === "dislike"
                  ? m.reaction_undo()
                  : m.reaction_dislike()}
              </Button>
              {property.reaction === "like" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  className={cn(
                    property.archived &&
                      "border-amber-600 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
                  )}
                  aria-label={
                    property.archived ? m.aria_unarchive() : m.aria_archive()
                  }
                  onClick={() => archiveMutation.mutate()}
                >
                  <Archive className="size-4" />
                  {property.archived
                    ? m.reaction_unarchive()
                    : m.reaction_archive()}
                </Button>
              ) : null}
            </>
          )}
          <PropertyPortalLinks property={property} />
        </CardFooter>
      </Card>
    </div>
  );
}
