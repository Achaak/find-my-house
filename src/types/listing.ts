export type ListingSource = "bienici" | "seloger";

export interface Listing {
  externalId: string;
  source: ListingSource;
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
  url: string;
  description: string | null;
  imageUrl: string | null;
  propertyType: string | null;
  scrapedAt: string;
}

export interface ListingSearchFilters {
  city?: string;
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
  maxTravelMinutes?: number;
  radiusKm?: number;
  limit?: number;
}

export interface ScrapeFilters {
  city: string;
  maxPrice: number;
  minSurface: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
  radiusKm?: number;
  maxTravelMinutes?: number;
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
