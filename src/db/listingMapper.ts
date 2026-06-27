import type {
  ListingPublication as PrismaPublication,
  Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";
import {
  parseImageLocalHashes,
  parseImagePerceptualHashes,
  parseImageUrls,
} from "../domain/publicationImages.js";
import { computePropertyDisplayProjection } from "../domain/propertyProjection.js";
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
    title: row.title,
    price: row.price,
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
    imageUrls: parseImageUrls(row.imageUrls),
    imageLocalHashes: parseImageLocalHashes(row.imageLocalHashes),
    imagePerceptualHashes: parseImagePerceptualHashes(
      row.imagePerceptualHashes
    ),
    enrichedAt: row.enrichedAt?.toISOString() ?? null,
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

export function tryToPropertyRow(
  row: PropertyWithPublications
): PropertyRow | null {
  if (row.publications.length === 0) return null;
  return toPropertyRow(row);
}

export function toPropertyRow(row: PropertyWithPublications): PropertyRow {
  const allPublications = sortPublications(
    row.publications.map(toPublicationRow)
  );

  if (allPublications.length === 0) {
    throw new InvariantError(`Property #${String(row.id)} has no publications`);
  }

  const publications = allPublications.filter(
    (publication) => publication.isActive
  );
  const display = computePropertyDisplayProjection(row.publications);

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
    address: display?.address ?? null,
    dpeNumero: display?.dpeNumero ?? null,
    propertyType: display?.propertyType ?? null,
    dpeClass: row.dpeClass,
    gesClass: row.gesClass,
    dpeConsumptionKwhM2: display?.dpeConsumptionKwhM2 ?? null,
    gesEmissionKgM2: display?.gesEmissionKgM2 ?? null,
    bathrooms: display?.bathrooms ?? null,
    constructionYear: display?.constructionYear ?? null,
    heating: display?.heating ?? null,
    orientation: display?.orientation ?? null,
    propertyCondition: display?.propertyCondition ?? null,
    parkingSpaces: display?.parkingSpaces ?? null,
    highlights: display?.highlights ?? null,
    addressEnrichedAt: row.addressEnrichedAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    publications,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Property row for compatibility training — no publication join. */
export function toCompatibilityTrainingProperty(
  row: PrismaProperty
): PropertyRow {
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
    address: null,
    dpeNumero: null,
    propertyType: null,
    dpeClass: row.dpeClass,
    gesClass: row.gesClass,
    dpeConsumptionKwhM2: null,
    gesEmissionKgM2: null,
    bathrooms: null,
    constructionYear: null,
    heating: null,
    orientation: null,
    propertyCondition: null,
    parkingSpaces: null,
    highlights: null,
    addressEnrichedAt: row.addressEnrichedAt?.toISOString() ?? null,
    firstSeenAt: row.firstSeenAt.toISOString(),
    publications: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
