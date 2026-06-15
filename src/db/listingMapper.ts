import type {
  ListingPublication as PrismaPublication,
  Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";
import { InvariantError } from "../utils/errors/invariantError.js";

type PropertyWithPublications = PrismaProperty & {
  publications: PrismaPublication[];
};

function toPublicationRow(row: PrismaPublication): PublicationRow {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source,
    url: row.url,
    isActive: row.isActive,
    scrapedAt: row.scrapedAt.toISOString(),
  };
}

export function parseHighlights(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const items = value.filter(
    (item): item is string => typeof item === "string"
  );
  return items.length > 0 ? items : null;
}

function sortPublications(publications: PublicationRow[]): PublicationRow[] {
  return [...publications].sort(
    (a, b) => new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime()
  );
}

export function toPropertyRow(row: PropertyWithPublications): PropertyRow {
  const allPublications = sortPublications(
    row.publications.map(toPublicationRow)
  );

  if (allPublications.length === 0) {
    throw new InvariantError(`Property #${String(row.id)} has no publications`);
  }

  const publications =
    allPublications.filter((publication) => publication.isActive).length > 0
      ? allPublications.filter((publication) => publication.isActive)
      : allPublications;

  const primary = publications[0];

  return {
    id: row.id,
    title: row.title,
    price: row.price,
    firstPrice: row.firstPrice,
    surface: row.surface,
    landSurface: row.landSurface,
    rooms: row.rooms,
    bedrooms: row.bedrooms,
    isNewProperty: row.isNewProperty,
    latitude: row.latitude,
    longitude: row.longitude,
    city: row.city,
    postalCode: row.postalCode,
    address: row.address,
    dpeNumero: row.dpeNumero,
    description: row.description,
    imageUrl: row.imageUrl,
    propertyType: row.propertyType,
    dpeClass: row.dpeClass,
    gesClass: row.gesClass,
    dpeConsumptionKwhM2: row.dpeConsumptionKwhM2,
    gesEmissionKgM2: row.gesEmissionKgM2,
    bathrooms: row.bathrooms,
    constructionYear: row.constructionYear,
    heating: row.heating,
    orientation: row.orientation,
    propertyCondition: row.propertyCondition,
    parkingSpaces: row.parkingSpaces,
    highlights: parseHighlights(row.highlights),
    displayEnrichedAt: row.displayEnrichedAt?.toISOString() ?? null,
    addressEnrichedAt: row.addressEnrichedAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    publications,
    url: primary.url,
    source: primary.source,
    scrapedAt: primary.scrapedAt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
