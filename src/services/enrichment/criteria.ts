import { Prisma } from "../../generated/prisma/client.js";
import type { PropertyRow, PublicationRow } from "../../types/listing.js";
import { isTruncatedPortalDescription } from "../../utils/classifiedPortal/parsers/detailDescription.js";
import { classifiedImageNeedsRefresh } from "../../utils/classifiedPortal/helpers.js";

export type EnrichmentPurpose = "display" | "address";

/**
 * First-time display enrichment: active publication never marked enriched.
 */
export function publicationNeedsFirstDisplayEnrichment(
  publication: PublicationRow
): boolean {
  return publication.isActive && publication.enrichedAt === null;
}

/**
 * Local image hashes missing for known remote URLs (DB-level, no filesystem).
 */
export function publicationHasIncompleteLocalImages(
  publication: Pick<
    PublicationRow,
    "isActive" | "imageUrls" | "imageLocalHashes"
  >
): boolean {
  if (!publication.isActive || !publication.imageUrls?.length) {
    return false;
  }

  const hashes = publication.imageLocalHashes;
  if (!hashes || Object.keys(hashes).length === 0) {
    return true;
  }

  return publication.imageUrls.some((url) => !hashes[url]);
}

/**
 * HTML-portal refresh after a first enrich (truncated description / stale image).
 * On-demand only — never part of backfill pending / stats.
 */
export function publicationNeedsDisplayRefresh(
  publication: PublicationRow
): boolean {
  if (!publication.isActive || !publication.enrichedAt) return false;
  if (publication.source !== "seloger" && publication.source !== "logicimmo") {
    return false;
  }
  if (isTruncatedPortalDescription(publication.description)) return true;
  if (classifiedImageNeedsRefresh(publication.imageUrl)) return true;
  return false;
}

function missingEnergyFields(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): boolean {
  const missingClasses =
    property.dpeClass === null || property.gesClass === null;
  if (purpose === "display") {
    return missingClasses;
  }

  return (
    missingClasses ||
    property.dpeConsumptionKwhM2 === null ||
    property.gesEmissionKgM2 === null
  );
}

export function propertyHasMissingEnrichmentFields(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): boolean {
  const missingEnergy = missingEnergyFields(property, purpose);
  const missingCoords =
    property.latitude === null || property.longitude === null;
  const hasHtmlPortalPublication = property.publications.some(
    (publication) =>
      publication.source === "seloger" || publication.source === "logicimmo"
  );

  if (purpose === "address") {
    return (
      missingEnergy ||
      property.surface === null ||
      (hasHtmlPortalPublication && missingCoords)
    );
  }

  return (
    missingEnergy ||
    property.landSurface === null ||
    property.publications.some(
      (publication) =>
        publicationNeedsFirstDisplayEnrichment(publication) ||
        publicationHasIncompleteLocalImages(publication)
    ) ||
    (hasHtmlPortalPublication && missingCoords)
  );
}

/**
 * Backfill / stats pending: first-time enrich or incomplete local image hashes.
 * Does not include sticky HTML-portal refresh.
 */
export function propertyNeedsDisplayBackfill(property: PropertyRow): boolean {
  return property.publications.some(
    (publication) =>
      publicationNeedsFirstDisplayEnrichment(publication) ||
      publicationHasIncompleteLocalImages(publication)
  );
}

export function propertyNeedsDisplayRefresh(property: PropertyRow): boolean {
  return property.publications.some(publicationNeedsDisplayRefresh);
}

/** Any display work: backfill intents or on-demand portal refresh. */
export function propertyNeedsDisplayWork(property: PropertyRow): boolean {
  return (
    propertyNeedsDisplayBackfill(property) ||
    propertyNeedsDisplayRefresh(property)
  );
}

export function propertyNeedsEnrichment(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): boolean {
  if (purpose === "address") {
    if (property.addressEnrichedAt !== null) return false;
    return propertyHasMissingEnrichmentFields(property, purpose);
  }

  return propertyNeedsDisplayBackfill(property);
}

export type EnrichmentStatus = "pending" | "complete";

/**
 * Status aligned with ensureReady: display pending means any display work
 * (backfill + refresh + incomplete images); address uses address criteria.
 */
export function getEnrichmentStatus(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): EnrichmentStatus {
  if (purpose === "display") {
    return propertyNeedsDisplayWork(property) ? "pending" : "complete";
  }
  return propertyNeedsEnrichment(property, purpose) ? "pending" : "complete";
}

/** SQL: first-time display enrichment. */
export function displayFirstEnrichmentPendingWhere(): Prisma.PropertyWhereInput {
  return {
    publications: {
      some: {
        isActive: true,
        enrichedAt: null,
      },
    },
  };
}

/** SQL: enriched pubs with remote image URLs but no local hash map yet. */
export function displayImageStoreIncompleteWhere(): Prisma.PropertyWhereInput {
  return {
    publications: {
      some: {
        isActive: true,
        enrichedAt: { not: null },
        NOT: { imageUrls: { equals: Prisma.DbNull } },
        OR: [
          { imageLocalHashes: { equals: Prisma.DbNull } },
          { imageLocalHashes: { equals: {} } },
        ],
      },
    },
  };
}

/**
 * Single SQL filter for DisplayEnrichmentPending (backfill + stats).
 * Matches `propertyNeedsDisplayBackfill` for the common cases; partial hash
 * maps are narrowed in-memory after scan.
 */
export function displayEnrichmentBackfillWhere(): Prisma.PropertyWhereInput {
  return {
    OR: [
      displayFirstEnrichmentPendingWhere(),
      displayImageStoreIncompleteWhere(),
    ],
  };
}
