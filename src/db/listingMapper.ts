import type { Listing as PrismaListing } from "../generated/prisma/client.js";
import type { ListingRow } from "../types/listing.js";

export function toListingRow(row: PrismaListing): ListingRow {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source as ListingRow["source"],
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
    url: row.url,
    description: row.description,
    imageUrl: row.imageUrl,
    propertyType: row.propertyType,
    scrapedAt: row.scrapedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
