import { apiFetch } from "./api-client";
import type {
  ApiUser,
  AddressConfirmResponse,
  AdminScrapeResponse,
  CompatibilityProfileResponse,
  BrowseState,
  ListingsResponse,
  ListingDetailResponse,
  ListingSearchFilters,
  NotificationDigest,
  Property,
  PropertyAddressSearchResponse,
  ReactionMutationResponse,
  ReactionsResponse,
  RemoveReactionResponse,
  EnrichmentBackfillResult,
  ReconcileResult,
  StatsResponseMap,
  StatsSection,
  PropertyMatchDiagnosticsPage,
  DiagnosticsQuery,
  VersionResponse,
} from "@find-my-house/api-types";
import { serializeDiagnosticsQuery } from "@find-my-house/api-types";

type ListingsWithPropertyResponse = Omit<ListingsResponse, "items"> & {
  items: Property[];
};

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
  const first = await apiFetch<ListingsWithPropertyResponse>(
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
    const page = await apiFetch<ListingsWithPropertyResponse>(
      `/api/listings?${pageQuery}`
    );
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
    return apiFetch<ListingsWithPropertyResponse>(
      `/api/listings${query ? `?${query}` : ""}`
    );
  },

  listingsAll: fetchAllListings,

  listing: (id: number) =>
    apiFetch<ListingDetailResponse>(`/api/listings/${String(id)}`),

  compatibilityProfile: () =>
    apiFetch<CompatibilityProfileResponse>("/api/compatibility/profile"),

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

  propertyMatchDiagnostics: (filters?: DiagnosticsQuery) => {
    const query = serializeDiagnosticsQuery(filters);
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
  compatibilityProfile: ["compatibility-profile"] as const,
  notifications: (since?: string) =>
    ["notifications", since ?? "default"] as const,
};
