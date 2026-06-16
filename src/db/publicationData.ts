import type { Listing, ListingSource } from "../types/listing.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import { Prisma } from "../generated/prisma/client.js";
import { toPropertyScalarData } from "./propertyFieldManifest.js";

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
    address: null,
    dpeNumero: null,
    scrapedAt,
    agencySlug: agency?.agencySlug ?? null,
    agencyRef: agency?.agencyRef ?? null,
  };
}

export function toPrismaPublicationData(data: PublicationCreateData) {
  return {
    ...data,
    highlights: data.highlights ?? Prisma.DbNull,
  };
}
