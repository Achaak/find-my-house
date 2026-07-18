import type { Listing, ListingSource } from "../types/listing.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import { Prisma } from "../generated/prisma/client.js";
import { toPropertyScalarData } from "./propertyFieldManifest.js";

function imageUrlListsEqual(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  const a = left ?? [];
  const b = right ?? [];
  if (a.length !== b.length) return false;
  return a.every((url, index) => url === b[index]);
}

export function publicationImageUrlsChanged(
  existing: string[] | null | undefined,
  listing: Listing
): boolean {
  return !imageUrlListsEqual(existing, listing.imageUrls);
}

export type PublicationCreateData = {
  externalId: string;
  source: ListingSource;
  url: string;
  title: string;
  price: number;
  surface: number | null;
  landSurface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  isNewProperty: boolean | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  postalCode: string | null;
  address: string | null;
  dpeNumero: string | null;
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[] | null;
  propertyType: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  dpeConsumptionKwhM2: number | null;
  gesEmissionKgM2: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
  scrapedAt: Date;
  agencySlug: string | null;
  agencyRef: string | null;
};

export function toPublicationCreateData(
  listing: Listing,
  scrapedAt: Date
): PublicationCreateData {
  const agency =
    listing.source === "bienici"
      ? parseBieniciAgency(listing.externalId)
      : null;

  return {
    externalId: listing.externalId,
    source: listing.source,
    url: listing.url,
    ...toPropertyScalarData(listing),
    imageUrls: listing.imageUrls,
    address: null,
    dpeNumero: null,
    scrapedAt,
    agencySlug: agency?.agencySlug ?? null,
    agencyRef: agency?.agencyRef ?? null,
  };
}

/** Fields scrape must not wipe when updating an existing publication. */
export type PublicationEnrichmentPreserve = {
  description: string | null;
  imageUrl: string | null;
  imageUrls: string[] | null;
  address: string | null;
  dpeNumero: string | null;
};

/**
 * Update payload for an existing publication. Search cards are often sparse;
 * keep prior portal-detail / address fields when the scrape omits them, and
 * never default address/dpe to null the way creates do.
 */
export function toPublicationUpdateData(
  listing: Listing,
  scrapedAt: Date,
  existing: PublicationEnrichmentPreserve
): PublicationCreateData {
  const data = toPublicationCreateData(listing, scrapedAt);
  data.address = existing.address;
  data.dpeNumero = existing.dpeNumero;
  data.description ??= existing.description;
  data.imageUrl ??= existing.imageUrl;
  if (data.imageUrls == null || data.imageUrls.length === 0) {
    data.imageUrls = existing.imageUrls;
  }
  return data;
}

export function toPrismaPublicationData(data: PublicationCreateData) {
  return {
    ...data,
    highlights: data.highlights ?? Prisma.DbNull,
    imageUrls: data.imageUrls ?? Prisma.DbNull,
  };
}
