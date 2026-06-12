import type { Listing, ListingSource } from "../types/listing.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";

export type PublicationCreateData = {
  externalId: string;
  source: ListingSource;
  url: string;
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
    scrapedAt,
    agencySlug: agency?.agencySlug ?? null,
    agencyRef: agency?.agencyRef ?? null,
  };
}
