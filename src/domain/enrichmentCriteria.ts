import type { Prisma } from "../generated/prisma/client.js";
import type { PropertyRow } from "../types/listing.js";
import { classifiedImageNeedsRefresh } from "../utils/classifiedPortal/helpers.js";

export type EnrichmentPurpose = "display" | "address";

const HTML_PORTAL_SOURCES = ["seloger", "logicimmo"] as const;

function enrichmentAttemptedAt(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): string | null {
  return purpose === "display"
    ? property.displayEnrichedAt
    : property.addressEnrichedAt;
}

function needsPortalImageRefresh(property: PropertyRow): boolean {
  const hasHtmlPortalPublication = property.publications.some(
    (publication) =>
      publication.source === "seloger" || publication.source === "logicimmo"
  );
  return (
    hasHtmlPortalPublication && classifiedImageNeedsRefresh(property.imageUrl)
  );
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
    property.description === null ||
    property.imageUrl === null ||
    (hasHtmlPortalPublication && missingCoords) ||
    needsPortalImageRefresh(property)
  );
}

export function propertyNeedsEnrichment(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): boolean {
  if (enrichmentAttemptedAt(property, purpose) !== null) {
    if (purpose === "display" && needsPortalImageRefresh(property)) {
      return true;
    }
    return false;
  }

  return propertyHasMissingEnrichmentFields(property, purpose);
}

export type EnrichmentStatus = "pending" | "complete";

export function getEnrichmentStatus(
  property: PropertyRow,
  purpose: EnrichmentPurpose
): EnrichmentStatus {
  return propertyNeedsEnrichment(property, purpose) ? "pending" : "complete";
}

/** Prisma filter matching `propertyNeedsEnrichment(property, "display")`. */
export function displayEnrichmentPendingWhere(): Prisma.PropertyWhereInput {
  const missingFields: Prisma.PropertyWhereInput = {
    OR: [
      { dpeClass: null },
      { gesClass: null },
      { landSurface: null },
      { description: null },
      { imageUrl: null },
      {
        publications: {
          some: { source: { in: [...HTML_PORTAL_SOURCES] } },
        },
        OR: [{ latitude: null }, { longitude: null }],
      },
    ],
  };

  const stalePortalImage: Prisma.PropertyWhereInput = {
    publications: {
      some: { source: { in: [...HTML_PORTAL_SOURCES] } },
    },
    OR: [
      { imageUrl: { contains: "v.seloger.com/s/width/" } },
      {
        AND: [
          {
            OR: [
              { imageUrl: { contains: "mms.logic-immo.com" } },
              { imageUrl: { contains: "mms.seloger.com" } },
            ],
          },
          { NOT: { imageUrl: { contains: "ci_seal=" } } },
        ],
      },
    ],
  };

  return {
    OR: [
      {
        AND: [{ displayEnrichedAt: null }, missingFields],
      },
      stalePortalImage,
    ],
  };
}
