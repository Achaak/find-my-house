import { z } from "zod";
import type { Listing, ListingSource } from "../types/listing.js";
import { createLogger } from "./logger.js";

const log = createLogger("validation");

const listingSourceSchema = z.enum([
  "bienici",
  "seloger",
  "leboncoin",
  "logicimmo",
]);

const listingSchema = z.object({
  externalId: z.string().min(1),
  source: listingSourceSchema,
  title: z.string().min(1),
  price: z.number().int().positive(),
  surface: z.number().positive().nullable(),
  landSurface: z.number().positive().nullable(),
  rooms: z.number().int().positive().nullable(),
  bedrooms: z.number().int().positive().nullable(),
  isNewProperty: z.boolean().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  city: z.string().min(1),
  postalCode: z.string().nullable(),
  url: z.url(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  imageUrls: z.array(z.string()).nullable().optional(),
  propertyType: z.string().nullable(),
  dpeClass: z.string().nullable(),
  gesClass: z.string().nullable(),
  dpeConsumptionKwhM2: z.number().nonnegative().nullable(),
  gesEmissionKgM2: z.number().nonnegative().nullable(),
  bathrooms: z.number().int().positive().nullable(),
  constructionYear: z.number().int().min(1800).max(2100).nullable(),
  heating: z.string().nullable(),
  orientation: z.string().nullable(),
  propertyCondition: z.string().nullable(),
  parkingSpaces: z.number().int().nonnegative().nullable(),
  highlights: z.array(z.string()).nullable(),
  scrapedAt: z.string().min(1),
});

export function parseListingSource(value: unknown): ListingSource | null {
  const parsed = listingSourceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function validateListing(listing: Listing): Listing | null {
  const parsed = listingSchema.safeParse(listing);
  if (parsed.success) return listing;

  log.warn(
    `Invalid listing (${listing.source}:${listing.externalId}): ${parsed.error.issues.map((issue) => issue.message).join(", ")}`
  );
  return null;
}

export function validateListings(listings: Listing[]): Listing[] {
  const valid: Listing[] = [];
  for (const listing of listings) {
    const parsed = validateListing(listing);
    if (parsed) valid.push(parsed);
  }
  return valid;
}
