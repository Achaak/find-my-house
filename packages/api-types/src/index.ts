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

export type PropertyCard = Pick<
  Property,
  | "id"
  | "title"
  | "price"
  | "firstPrice"
  | "surface"
  | "landSurface"
  | "rooms"
  | "bedrooms"
  | "city"
  | "postalCode"
  | "imageUrl"
  | "publications"
  | "url"
  | "source"
  | "compatibilityScore"
  | "reaction"
  | "archived"
>;

export type PropertyDetail = Property;

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

export type VersionResponse = {
  version: string;
  commit?: string;
};

export type ListingsResponse = {
  items: PropertyCard[];
  total: number;
  zone?: string;
};

export type BrowseStopResponse = {
  reviewed: number;
};

export type ReactionsResponse = {
  items: Property[];
};

export type ReactionMutationResponse = {
  status: string;
};

export type RemoveReactionResponse = {
  removed: boolean;
};

export type AddressConfirmResponse = {
  address: string;
  dpeNumero: string;
};

export type AdminScrapeResponse = {
  summary: string;
  result: unknown;
};

export type PropertyMatchNearMiss = {
  candidateId: number;
  score: number;
  veto: string | null;
};

export type PropertyMatchDiagnosticItem = {
  id: number;
  listingSource: ListingSource;
  listingExternalId: string;
  postalCode: string | null;
  threshold: number;
  bestScore: number | null;
  bestCandidateId: number | null;
  bestVeto: string | null;
  nearMisses: PropertyMatchNearMiss[];
  createdAt: string;
};

export type AdminDiagnosticItem = PropertyMatchDiagnosticItem;

export type PropertyMatchDiagnosticsPage = {
  items: AdminDiagnosticItem[];
  nextBeforeId: number | null;
};

export type DiagnosticsQuery = {
  limit?: number;
  source?: ListingSource;
  postalCode?: string;
  bestVeto?: string;
  from?: string;
  to?: string;
  beforeId?: number;
};

const DIAGNOSTIC_SOURCES: ListingSource[] = [
  "bienici",
  "seloger",
  "leboncoin",
  "logicimmo",
];

export function serializeDiagnosticsQuery(
  filters: DiagnosticsQuery = {}
): string {
  const params = new URLSearchParams();
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters.source) params.set("source", filters.source);
  if (filters.postalCode) params.set("postalCode", filters.postalCode);
  if (filters.bestVeto) params.set("bestVeto", filters.bestVeto);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.beforeId !== undefined) {
    params.set("beforeId", String(filters.beforeId));
  }
  return params.toString();
}

export function parseDiagnosticsQuery(input: {
  limit?: string;
  source?: string;
  postalCode?: string;
  bestVeto?: string;
  from?: string;
  to?: string;
  beforeId?: string;
}): { value?: DiagnosticsQuery; error?: string } {
  const sourceRaw = input.source?.trim();
  if (sourceRaw && !DIAGNOSTIC_SOURCES.includes(sourceRaw as ListingSource)) {
    return { error: "Invalid source" };
  }

  const limitRaw = input.limit?.trim();
  let limit: number | undefined;
  if (limitRaw) {
    const parsed = Number.parseInt(limitRaw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: "Invalid limit" };
    }
    limit = parsed;
  }

  const beforeIdRaw = input.beforeId?.trim();
  let beforeId: number | undefined;
  if (beforeIdRaw) {
    const parsed = Number.parseInt(beforeIdRaw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: "Invalid beforeId" };
    }
    beforeId = parsed;
  }

  const from = input.from?.trim();
  if (from) {
    const parsed = new Date(from);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid from timestamp" };
    }
  }

  const to = input.to?.trim();
  if (to) {
    const parsed = new Date(to);
    if (Number.isNaN(parsed.getTime())) {
      return { error: "Invalid to timestamp" };
    }
  }

  return {
    value: {
      limit,
      source: sourceRaw as ListingSource | undefined,
      postalCode: input.postalCode?.trim() || undefined,
      bestVeto: input.bestVeto?.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      beforeId,
    },
  };
}
