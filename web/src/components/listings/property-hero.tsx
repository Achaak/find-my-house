import { Link } from "@tanstack/react-router";
import { PropertyPhotoCarousel } from "@/components/listings/property-photo-carousel";
import { PropertySummaryBadges } from "@/components/listings/property-summary-badges";
import { PropertyImageSkeleton } from "@/components/listings/listing-detail-skeleton";
import { buttonVariants } from "@/components/ui/button";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property, PropertyDetail } from "@find-my-house/api-types";
import { cn, formatPrice, formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function PropertyHero({
  property,
  imageSkeleton = false,
}: {
  property: Property;
  imageSkeleton?: boolean;
}) {
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
        ) : (
          <PropertyPhotoCarousel
            photos={property.photos}
            alt={imageAlt}
            imageClassName="aspect-[16/10] md:aspect-[21/9]"
            overlayFriendly
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 text-white [&_.border]:border-white/30 [&_.bg-secondary]:bg-white/15 [&_.text-foreground]:text-white">
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

export function PropertyPublicationsSection({
  property,
}: {
  property: PropertyDetail;
}) {
  if (!property.publicationDetails?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {m.property_publications_section_title()}
      </h2>
      <div className="space-y-3">
        {property.publicationDetails.map((publication) => (
          <article
            key={publication.id}
            className="rounded-xl border bg-card p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">
                {formatSource(publication.source)}
              </h3>
              <a
                href={publication.url}
                target="_blank"
                rel="noreferrer noopener"
                className="text-sm text-primary underline-offset-4 hover:underline"
              >
                {m.portal_dropdown_label()}
              </a>
            </div>
            <dl className="mt-3 space-y-2 text-sm">
              {publication.price !== property.price ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    {m.listing_publication_price()}
                  </dt>
                  <dd className="font-medium">
                    {formatPrice(publication.price)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function PropertyMapPreview({ property }: { property: Property }) {
  const summary = buildPropertySummary(property);

  return (
    <div className="space-y-3">
      <PropertyPhotoCarousel
        photos={property.photos}
        alt={summary.title}
        imageClassName="aspect-video rounded-lg"
        className="rounded-lg"
      />
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
