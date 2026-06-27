import type { Prisma } from "../generated/prisma/client.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";
import { isTruncatedPortalDescription } from "../utils/classifiedPortal/parsers/detailDescription.js";
import { classifiedImageNeedsRefresh } from "../utils/classifiedPortal/helpers.js";

export type EnrichmentPurpose = "display" | "address";

const HTML_PORTAL_SOURCES = ["seloger", "logicimmo"] as const;

export function publicationNeedsDisplayEnrichment(
  publication: PublicationRow
): boolean {
  if (!publication.isActive) return false;
  if (!publication.enrichedAt) return true;

  if (publication.source === "seloger" || publication.source === "logicimmo") {
    if (isTruncatedPortalDescription(publication.description)) return true;
    if (classifiedImageNeedsRefresh(publication.imageUrl)) return true;
  }

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
    property.publications.some(publicationNeedsDisplayEnrichment) ||
    (hasHtmlPortalPublication && missingCoords)
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

  return property.publications.some(publicationNeedsDisplayEnrichment);
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
  const pendingEnrichment: Prisma.PropertyWhereInput = {
    publications: {
      some: {
        isActive: true,
        enrichedAt: null,
      },
    },
  };

  const stalePortalImage: Prisma.PropertyWhereInput = {
    publications: {
      some: {
        isActive: true,
        source: { in: [...HTML_PORTAL_SOURCES] },
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
      },
    },
  };

  const truncatedPortalDescription: Prisma.PropertyWhereInput = {
    publications: {
      some: {
        isActive: true,
        source: { in: [...HTML_PORTAL_SOURCES] },
        OR: [{ description: null }, { description: { endsWith: "..." } }],
      },
    },
  };

  return {
    OR: [pendingEnrichment, stalePortalImage, truncatedPortalDescription],
  };
}
