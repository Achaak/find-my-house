import { apiFetch } from "./api-client";
import type {
  ApiUser,
  AddressConfirmResponse,
  AdminScrapeResponse,
  AdminNotificationTestResponse,
  CompatibilityProfileResponse,
  BrowseState,
  BrowseStopResponse,
  ListingsResponse,
  ListingDetailResponse,
  ListingSearchFilters,
  NotificationDigest,
  NotificationPreferences,
  Property,
  PropertyAddressSearchResponse,
  ReactionMutationResponse,
  ReactionsResponse,
  UndoDislikeResponse,
  RemoveReactionResponse,
  EnrichmentBackfillResult,
  ReconcileResult,
  StatsResponseMap,
  StatsSection,
  StatsSeriesData,
  StatsSeriesRange,
  PropertyMatchDiagnosticsPage,
  DiagnosticsQuery,
  VersionResponse,
} from "@find-my-house/api-types";
import { serializeListingSearchFilters } from "@find-my-house/api-types";
import { serializeDiagnosticsQuery } from "@find-my-house/api-types";

type ListingsWithPropertyResponse = Omit<ListingsResponse, "items"> & {
  items: Property[];
};

function searchParams(
  filters: ListingSearchFilters,
  options: { map?: boolean } = {}
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(
    serializeListingSearchFilters(filters)
  )) {
    params.set(key, value);
  }
  if (options.map) {
    params.set("map", "true");
  }
  return params.toString();
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

  listingsMap: (filters: ListingSearchFilters = {}) => {
    const mapFilters: ListingSearchFilters = { ...filters };
    delete mapFilters.offset;
    delete mapFilters.limit;
    const query = searchParams(mapFilters, { map: true });
    return apiFetch<ListingsWithPropertyResponse>(`/api/listings?${query}`);
  },

  listing: (id: number) =>
    apiFetch<ListingDetailResponse>(`/api/listings/${String(id)}`),

  compatibilityProfile: () =>
    apiFetch<CompatibilityProfileResponse>("/api/compatibility/profile"),

  browseStart: () =>
    apiFetch<BrowseState>("/api/browse/start", { method: "POST" }),

  browseCurrent: () => apiFetch<BrowseState>("/api/browse"),

  browseStop: () =>
    apiFetch<BrowseStopResponse>("/api/browse/stop", { method: "POST" }),

  browseReact: (action: "like" | "dislike" | "pass", propertyId: number) =>
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

  undoDislike: (propertyId: number) =>
    apiFetch<UndoDislikeResponse>(
      `/api/reactions/dislike/${String(propertyId)}/undo`,
      { method: "POST" }
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

  statsSeries: (range: StatsSeriesRange = "30d") =>
    apiFetch<StatsSeriesData>(`/api/stats/series?range=${range}`),

  notificationsDigest: (since?: string) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : "";
    return apiFetch<NotificationDigest>(`/api/notifications/digest${query}`);
  },

  notificationPreferences: () =>
    apiFetch<NotificationPreferences>("/api/notifications/preferences"),

  updateNotificationPreferences: (enabled: boolean) =>
    apiFetch<NotificationPreferences>("/api/notifications/preferences", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

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

  testNotification: () =>
    apiFetch<AdminNotificationTestResponse>("/api/admin/notifications/test", {
      method: "POST",
    }),

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
  statsSeries: (range: StatsSeriesRange) => ["stats-series", range] as const,
  address: (id: number) => ["address", id] as const,
  compatibilityProfile: ["compatibility-profile"] as const,
  notificationPreferences: ["notification-preferences"] as const,
  notifications: (since?: string) =>
    ["notifications", since ?? "default"] as const,
};
