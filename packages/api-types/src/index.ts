/** Shared REST API contract between backend and web UI. */

export type ListingSource = "bienici" | "seloger" | "leboncoin" | "logicimmo";

export type ListingSearchSort =
  | "price_asc"
  | "price_desc"
  | "date_desc"
  | "surface_desc"
  | "compat_desc";

export type PropertyReactionState = "like" | "dislike" | null;

export type PropertyPublication = {
  id: number;
  externalId: string;
  source: ListingSource;
  url: string;
  isActive: boolean;
  scrapedAt: string;
};

export type Property = {
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
  publications: PropertyPublication[];
  url: string;
  source: ListingSource;
  scrapedAt: string;
  createdAt: string;
  updatedAt: string;
  compatibilityScore?: number;
  reaction?: PropertyReactionState;
  archived?: boolean;
};

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
  sort?: ListingSearchSort;
  limit?: number;
};

export type ApiUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export type BrowseState = {
  item: Property | null;
  shownCount: number;
  isExplore: boolean;
  hasPreferences: boolean;
  finished: boolean;
};

export type DpeCandidate = {
  numeroDpe: string;
  address: string;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  dpeClass: string | null;
  surface: number | null;
};

export type ReconcileResult = {
  merged: number;
  fuzzyMerged: number;
  unique: number;
  agencyFieldsUpdated: number;
};
