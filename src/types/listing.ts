import type {
  ListingSearchFilters as ApiListingSearchFilters,
  ListingSearchSort,
  ListingSource,
} from "@find-my-house/api-types";

export type { ListingSource, ListingSearchSort };

export type ListingSearchFilters = ApiListingSearchFilters & {
  excludeReactedByUser?: string;
};

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
  scrapedAt: string;
};

export type PublicationRow = {
  id: number;
  externalId: string;
  source: ListingSource;
  url: string;
  isActive: boolean;
  scrapedAt: string;
};

export type PropertyRow = {
  id: number;
  title: string;
  price: number;
  firstPrice: number;
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
  firstSeenAt: string;
  publications: PublicationRow[];
  url: string;
  source: ListingSource;
  scrapedAt: string;
  createdAt: string;
  updatedAt: string;
};

/** Shared listing filters across portal APIs. */
export type PortalListingCriteria = {
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
};

export type ScrapeFilters = {
  city: string;
  postalCode?: string;
  maxPrice: number;
  minSurface: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
  maxTravelMinutes?: number;
};

export type UpsertStatus = "inserted" | "linked" | "updated" | "skipped";

export type ScrapeResult = {
  found: number;
  inserted: number;
  linked: number;
  updated: number;
  skipped: number;
  deactivated: number;
};

export type ScraperError = {
  scraper: string;
  message: string;
};

export type ExtendedScrapeResult = ScrapeResult & {
  insertedListings: PropertyRow[];
  priceDropListings: PropertyRow[];
  errors: ScraperError[];
};
