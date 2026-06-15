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

export type EnrichmentStatus = "pending" | "complete";

export type ListingDetailResponse = {
  item: Property;
  enrichment: { status: EnrichmentStatus };
};

export type PropertyAddressSearchResponse = {
  readiness: string;
  enrichment: { status: EnrichmentStatus };
  query?: unknown;
  warnings: string[];
  candidates: DpeCandidate[];
  error?: string;
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
  priceDropOnly?: boolean;
  sort?: ListingSearchSort;
  limit?: number;
  offset?: number;
};

export type SourcePublicationCounts = Record<
  ListingSource,
  { active: number; inactive: number }
>;

export type PriceStats = {
  count: number;
  min: number;
  max: number;
  median: number;
  average: number;
};

export type CityCount = {
  city: string;
  count: number;
};

export type ActivityStats = {
  lastScrapedAt: string | null;
  addedLast7Days: number;
  deactivatedLast7Days: number;
  multiSourceCount: number;
};

export type EnrichmentStats = {
  pending: number;
  queued: number;
};

export type StatsOverview = {
  total: number;
  activeProperties: number;
  activePublications: number;
  inactivePublications: number;
  priceDrops: number;
  sourceCounts: SourcePublicationCounts;
  priceStats: PriceStats | null;
  topCities: CityCount[];
  activity: ActivityStats;
  likes: number;
  dislikes: number;
  enrichment: EnrichmentStats;
  recent: Property[];
};

export type StatsSources = {
  sourceCounts: SourcePublicationCounts;
  multiSourceCount: number;
};

export type StatsPrices = {
  priceStats: PriceStats | null;
  priceDrops: number;
  drops: Property[];
};

export type StatsMine = {
  likes: number;
  dislikes: number;
  recentLikes: Property[];
  recentDislikes: Property[];
};

export type StatsActivity = {
  activity: ActivityStats;
  enrichment: EnrichmentStats;
  zoneLabel: string;
  cron: string;
  scrapers: string[];
  recent: Property[];
};

export type StatsSection =
  | "overview"
  | "sources"
  | "prices"
  | "mine"
  | "activity";

export type StatsResponseMap = {
  overview: StatsOverview;
  sources: StatsSources;
  prices: StatsPrices;
  mine: StatsMine;
  activity: StatsActivity;
};

export type NotificationDigest = {
  since: string;
  newListings: Property[];
  priceDrops: Property[];
  lastScrapedAt: string | null;
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
  criteria?: ListingSearchFilters;
  zoneLabel?: string;
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

export type EnrichmentBackfillResult = {
  queued: number;
};
