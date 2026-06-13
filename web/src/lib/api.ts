import { apiFetch } from "./api-client";
import type {
  ApiUser,
  BrowseState,
  DpeCandidate,
  ListingSearchFilters,
  Property,
  ReconcileResult,
} from "./types";

function searchParams(filters: ListingSearchFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  return params.toString();
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

  listing: (id: number) =>
    apiFetch<{ item: Property }>(`/api/listings/${String(id)}`),

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

  reactions: (type: "like" | "dislike", limit = 20) =>
    apiFetch<{ items: Property[] }>(
      `/api/reactions/${type}?limit=${String(limit)}`
    ),

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

  stats: <T extends string>(section: T) =>
    apiFetch<unknown>(`/api/stats/${section}`),

  addressSearch: (propertyId: number) =>
    apiFetch<{
      readiness: string;
      query?: unknown;
      warnings: string[];
      candidates: DpeCandidate[];
      error?: string;
    }>(`/api/properties/${String(propertyId)}/address`),

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
};

export const queryKeys = {
  me: ["me"] as const,
  version: ["version"] as const,
  listings: (filters: ListingSearchFilters) => ["listings", filters] as const,
  listing: (id: number) => ["listing", id] as const,
  browse: ["browse"] as const,
  reactions: (type: "like" | "dislike") => ["reactions", type] as const,
  stats: (section: string) => ["stats", section] as const,
  address: (id: number) => ["address", id] as const,
};
