import type {
  ListingPublication as PrismaPublication,
  Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type { PropertyRow, PublicationRow } from "../types/listing.js";

type PropertyWithPublications = PrismaProperty & {
  publications: PrismaPublication[];
};

function toPublicationRow(row: PrismaPublication): PublicationRow {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source,
    url: row.url,
    scrapedAt: row.scrapedAt.toISOString(),
  };
}

export function toPropertyRow(row: PropertyWithPublications): PropertyRow {
  const publications = row.publications
    .map(toPublicationRow)
    .sort(
      (a, b) =>
        new Date(a.scrapedAt).getTime() - new Date(b.scrapedAt).getTime()
    );
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
    firstSeenAt: row.firstSeenAt.toISOString(),
    notifiedAt: row.notifiedAt?.toISOString() ?? null,
    publications,
    url: primary.url,
    source: primary.source,
    scrapedAt: primary.scrapedAt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
