import { apiFetch } from "./api-client";
import type {
  ApiUser,
  AddressConfirmResponse,
  AdminScrapeResponse,
  BrowseStopResponse,
  BrowseState,
  ListingsResponse,
  ListingDetailResponse,
  ListingSearchFilters,
  NotificationDigest,
  PropertyAddressSearchResponse,
  ReactionMutationResponse,
  ReactionsResponse,
  RemoveReactionResponse,
  EnrichmentBackfillResult,
  ReconcileResult,
  StatsResponseMap,
  StatsSection,
  PropertyMatchDiagnosticsPage,
  VersionResponse,
} from "./types";

function searchParams(filters: ListingSearchFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function fetchAllListings(filters: ListingSearchFilters = {}) {
  const pageLimit = 100;
  const query = searchParams({ ...filters, offset: 0, limit: pageLimit });
  const first = await apiFetch<ListingsResponse>(
    `/api/listings${query ? `?${query}` : ""}`
  );
  const items = [...first.items];
  let offset = items.length;

  while (offset < first.total) {
    const pageQuery = searchParams({
      ...filters,
      offset,
      limit: pageLimit,
    });
    const page = await apiFetch<ListingsResponse>(`/api/listings?${pageQuery}`);
    if (page.items.length === 0) break;
    items.push(...page.items);
    offset += page.items.length;
  }

  return { items, total: first.total, zone: first.zone };
}

export const api = {
  me: () => apiFetch<ApiUser>("/api/me"),

  version: () => apiFetch<VersionResponse>("/api/version"),

  listings: (filters: ListingSearchFilters = {}) => {
    const query = searchParams(filters);
    return apiFetch<ListingsResponse>(
      `/api/listings${query ? `?${query}` : ""}`
    );
  },

  listingsAll: fetchAllListings,

  listing: (id: number) =>
    apiFetch<ListingDetailResponse>(`/api/listings/${String(id)}`),

  browseStart: () =>
    apiFetch<BrowseState>("/api/browse/start", { method: "POST" }),

  browseCurrent: () => apiFetch<BrowseState>("/api/browse"),

  browseStop: () =>
    apiFetch<BrowseStopResponse>("/api/browse/stop", { method: "POST" }),

  browseReact: (action: "like" | "dislike", propertyId: number) =>
    apiFetch<BrowseState>(`/api/browse/${action}`, {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  reactions: (
    type: "like" | "dislike",
    options: {
      limit?: number;
      includeArchived?: boolean;
      archivedOnly?: boolean;
    } = {}
  ) => {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 100),
    });
    if (options.includeArchived) params.set("includeArchived", "true");
    if (options.archivedOnly) params.set("archivedOnly", "true");
    return apiFetch<ReactionsResponse>(
      `/api/reactions/${type}?${params.toString()}`
    );
  },

  addReaction: (type: "like" | "dislike", propertyId: number) =>
    apiFetch<ReactionMutationResponse>(`/api/reactions/${type}`, {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  removeReaction: (type: "like" | "dislike", propertyId: number) =>
    apiFetch<RemoveReactionResponse>(
      `/api/reactions/${type}/${String(propertyId)}`,
      {
        method: "DELETE",
      }
    ),

  archiveLike: (propertyId: number) =>
    apiFetch<ReactionMutationResponse>(
      `/api/reactions/like/${String(propertyId)}/archive`,
      { method: "POST" }
    ),

  unarchiveLike: (propertyId: number) =>
    apiFetch<ReactionMutationResponse>(
      `/api/reactions/like/${String(propertyId)}/unarchive`,
      { method: "POST" }
    ),

  stats: <T extends StatsSection>(section: T) =>
    apiFetch<StatsResponseMap[T]>(`/api/stats/${section}`),

  notificationsDigest: (since?: string) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return apiFetch<NotificationDigest>(`/api/notifications/digest${query}`);
  },

  addressSearch: (propertyId: number) =>
    apiFetch<PropertyAddressSearchResponse>(
      `/api/properties/${String(propertyId)}/address`
    ),

  addressConfirm: (propertyId: number, numeroDpe: string) =>
    apiFetch<AddressConfirmResponse>(
      `/api/properties/${String(propertyId)}/address/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ numeroDpe }),
      }
    ),

  scrape: () =>
    apiFetch<AdminScrapeResponse>("/api/admin/scrape", {
      method: "POST",
    }),

  reconcile: () =>
    apiFetch<ReconcileResult>("/api/admin/reconcile", { method: "POST" }),

  enrich: () =>
    apiFetch<EnrichmentBackfillResult>("/api/admin/enrich", { method: "POST" }),

  propertyMatchDiagnostics: (filters?: {
    limit?: number;
    source?: string;
    postalCode?: string;
    bestVeto?: string;
    from?: string;
    to?: string;
    beforeId?: number;
  }) => {
    const params = new URLSearchParams();
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.source) params.set("source", filters.source);
    if (filters?.postalCode) params.set("postalCode", filters.postalCode);
    if (filters?.bestVeto) params.set("bestVeto", filters.bestVeto);
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.beforeId) params.set("beforeId", String(filters.beforeId));
    const query = params.toString();
    return apiFetch<PropertyMatchDiagnosticsPage>(
      `/api/admin/property-match-diagnostics${query ? `?${query}` : ""}`
    );
  },
};

export const queryKeys = {
  me: ["me"] as const,
  version: ["version"] as const,
  listings: (filters: ListingSearchFilters) => ["listings", filters] as const,
  listing: (id: number) => ["listing", id] as const,
  browse: ["browse"] as const,
  reactions: (
    type: "like" | "dislike",
    options?: { includeArchived?: boolean; archivedOnly?: boolean }
  ) => ["reactions", type, options ?? {}] as const,
  stats: (section: StatsSection) => ["stats", section] as const,
  address: (id: number) => ["address", id] as const,
  notifications: (since?: string) =>
    ["notifications", since ?? "default"] as const,
};
