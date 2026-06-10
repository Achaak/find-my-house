export type ListingSource = "bienici" | "seloger";

export interface Listing {
  externalId: string;
  source: ListingSource;
  title: string;
  price: number;
  surface: number | null;
  rooms: number | null;
  city: string;
  postalCode: string | null;
  url: string;
  description: string | null;
  imageUrl: string | null;
  propertyType: string | null;
  scrapedAt: string;
}

export interface ListingRow extends Listing {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScrapeResult {
  found: number;
  inserted: number;
  updated: number;
  skipped: number;
}
