import { apiFetch } from "./api-client";
import type {
  ApiUser,
  BrowseState,
  ListingDetailResponse,
  ListingSearchFilters,
  NotificationDigest,
  Property,
  PropertyAddressSearchResponse,
  EnrichmentBackfillResult,
  ReconcileResult,
  StatsResponseMap,
  StatsSection,
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
  const first = await apiFetch<{
    items: Property[];
    total: number;
    zone?: string;
  }>(`/api/listings${query ? `?${query}` : ""}`);
  const items = [...first.items];
  let offset = items.length;

  while (offset < first.total) {
    const pageQuery = searchParams({
      ...filters,
      offset,
      limit: pageLimit,
    });
    const page = await apiFetch<{
      items: Property[];
      total: number;
      zone?: string;
    }>(`/api/listings?${pageQuery}`);
    if (page.items.length === 0) break;
    items.push(...page.items);
    offset += page.items.length;
  }

  return { items, total: first.total, zone: first.zone };
}

export const api = {
  me: () => apiFetch<ApiUser>("/api/me"),

  version: () => apiFetch<{ version: string; commit?: string }>("/api/version"),

  listings: (filters: ListingSearchFilters = {}) => {
    const query = searchParams(filters);
    return apiFetch<{ items: Property[]; total: number; zone?: string }>(
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
    apiFetch<{ reviewed: number }>("/api/browse/stop", { method: "POST" }),

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
    return apiFetch<{ items: Property[] }>(
      `/api/reactions/${type}?${params.toString()}`
    );
  },

  addReaction: (type: "like" | "dislike", propertyId: number) =>
    apiFetch<{ status: string }>(`/api/reactions/${type}`, {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  removeReaction: (type: "like" | "dislike", propertyId: number) =>
    apiFetch<{ removed: boolean }>(
      `/api/reactions/${type}/${String(propertyId)}`,
      {
        method: "DELETE",
      }
    ),

  archiveLike: (propertyId: number) =>
    apiFetch<{ status: string }>(
      `/api/reactions/like/${String(propertyId)}/archive`,
      { method: "POST" }
    ),

  unarchiveLike: (propertyId: number) =>
    apiFetch<{ status: string }>(
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
    apiFetch<{ address: string; dpeNumero: string }>(
      `/api/properties/${String(propertyId)}/address/confirm`,
      {
        method: "POST",
        body: JSON.stringify({ numeroDpe }),
      }
    ),

  scrape: () =>
    apiFetch<{ summary: string; result: unknown }>("/api/admin/scrape", {
      method: "POST",
    }),

  reconcile: () =>
    apiFetch<ReconcileResult>("/api/admin/reconcile", { method: "POST" }),

  enrich: () =>
    apiFetch<EnrichmentBackfillResult>("/api/admin/enrich", { method: "POST" }),
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
