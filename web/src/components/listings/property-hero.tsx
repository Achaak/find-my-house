import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PropertySummaryBadges } from "@/components/listings/property-summary-badges";
import { PropertyImageSkeleton } from "@/components/listings/listing-detail-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { cn, formatPrice } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertyHero({
  property,
  imageSkeleton = false,
}: {
  property: Property;
  imageSkeleton?: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const summary = buildPropertySummary(property);
  const imageAlt = m.property_image_alt({
    title: property.title,
    city: property.city,
  });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="relative">
        {imageSkeleton ? (
          <PropertyImageSkeleton />
        ) : property.imageUrl && !imageFailed ? (
          <img
            src={property.imageUrl}
            alt={imageAlt}
            className="aspect-[16/10] w-full object-cover md:aspect-[21/9]"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted text-muted-foreground md:aspect-[21/9]">
            {m.property_no_photo()}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 text-white [&_.border]:border-white/30 [&_.bg-secondary]:bg-white/15 [&_.text-foreground]:text-white">
          <PropertySummaryBadges property={property} badges={summary.badges} />
          <h1 className="mt-2 text-xl font-semibold leading-tight md:text-2xl">
            {summary.title}
          </h1>
          <p className="mt-1 text-sm text-white/85">{summary.locationLine}</p>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight">
              {formatPrice(summary.price)}
            </span>
            {summary.priceDropLabel ? (
              <span className="text-sm text-white/75 line-through">
                {formatPrice(summary.firstPrice)}
              </span>
            ) : null}
          </div>
          {summary.specs.length ? (
            <p className="mt-2 text-sm text-white/85">{summary.specsLine}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PropertyMapPreview({ property }: { property: Property }) {
  const [imageFailed, setImageFailed] = useState(false);
  const summary = buildPropertySummary(property);

  return (
    <div className="space-y-3">
      {property.imageUrl && !imageFailed ? (
        <img
          src={property.imageUrl}
          alt={summary.title}
          className="aspect-video w-full rounded-lg object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
          {m.property_no_photo()}
        </div>
      )}
      <PropertySummaryBadges property={property} badges={summary.badges} />
      <div>
        <p className="line-clamp-2 font-semibold">{summary.title}</p>
        <p className="text-sm text-muted-foreground">{summary.locationLine}</p>
        <p className="mt-1 text-xl font-semibold">
          {formatPrice(summary.price)}
        </p>
        {summary.specsLine ? (
          <p className="text-sm text-muted-foreground">{summary.specsLine}</p>
        ) : null}
      </div>
      <Link
        to="/listings/$id"
        params={{ id: String(property.id) }}
        className={cn(buttonVariants(), "w-full")}
      >
        {m.property_details()}
      </Link>
    </div>
  );
}
