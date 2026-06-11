export type ListingSource = "bienici" | "seloger" | "leboncoin";

export type Listing = {
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
};

export type ListingSearchFilters = {
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
};

export type ScrapeFilters = {
  city: string;
  maxPrice: number;
  minSurface: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
  radiusKm?: number;
  maxTravelMinutes?: number;
};

export type ListingRow = Listing & {
  id: number;
  createdAt: string;
  updatedAt: string;
};

export type ScrapeResult = {
  found: number;
  inserted: number;
  updated: number;
  skipped: number;
};
