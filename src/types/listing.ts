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
  dpeClass: string | null;
  gesClass: string | null;
  scrapedAt: string;
};

export type PublicationRow = {
  id: number;
  externalId: string;
  source: ListingSource;
  url: string;
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
  description: string | null;
  imageUrl: string | null;
  propertyType: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  firstSeenAt: string;
  notifiedAt: string | null;
  publications: PublicationRow[];
  url: string;
  source: ListingSource;
  scrapedAt: string;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Alias kept for the Discord layer */
export type ListingRow = PropertyRow;

export type ListingSearchSort =
  | "price_asc"
  | "price_desc"
  | "date_desc"
  | "surface_desc";

export type ListingSearchFilters = {
  city?: string;
  postalCode?: string;
  text?: string;
  source?: ListingSource;
  minPrice?: number;
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
  neufOnly?: boolean;
  maxTravelMinutes?: number;
  radiusKm?: number;
  sort?: ListingSearchSort;
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

export type UpsertStatus = "inserted" | "linked" | "updated" | "skipped";

export type ScrapeResult = {
  found: number;
  inserted: number;
  linked: number;
  updated: number;
  skipped: number;
};
