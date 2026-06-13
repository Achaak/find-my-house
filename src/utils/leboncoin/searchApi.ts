import type { PortalListingCriteria } from "../../types/listing.js";
import type { LeboncoinAd, LeboncoinLocation } from "./client.js";

export const LEBONCOIN_SEARCH_API = "https://api.leboncoin.fr/finder/search";
const DEFAULT_PAGE_SIZE = 35;

type LeboncoinSearchApiResponse = {
  ads?: LeboncoinAd[];
  total?: number;
  max_pages?: number;
};

export type LeboncoinSearchRequest = {
  filters: {
    category: { id: string };
    enums: Record<string, string[]>;
    ranges: Record<string, { min?: number; max?: number }>;
    location?: {
      area: { lat: number; lng: number; radius: number };
    };
    keywords?: { text: string };
  };
  limit: number;
  offset: number;
  owner_type: "all";
  sort_by: "time";
  sort_order: "desc";
};

function resolveSearchText(location: LeboncoinLocation): string | undefined {
  if (location.city?.trim()) return location.city.trim();
  return location.label?.split(" (")[0]?.trim() ?? location.label?.trim();
}

export function buildLeboncoinSearchRequest(
  criteria: PortalListingCriteria,
  location: LeboncoinLocation,
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE
): LeboncoinSearchRequest {
  const enums: Record<string, string[]> = {
    ad_type: ["offer"],
    real_estate_type: ["1"],
  };
  if (criteria.ancienOnly) {
    enums.immo_sell_type = ["old"];
  }

  const ranges: LeboncoinSearchRequest["filters"]["ranges"] = {};
  if (criteria.maxPrice !== undefined) {
    ranges.price = { min: 0, max: criteria.maxPrice };
  }
  if (criteria.minSurface !== undefined) {
    ranges.square = { min: criteria.minSurface };
  }
  if (criteria.minLandSurface !== undefined) {
    ranges.land_plot_surface = { min: criteria.minLandSurface };
  }
  if (criteria.minRooms !== undefined) {
    ranges.rooms = { min: criteria.minRooms };
  }
  if (criteria.minBedrooms !== undefined) {
    ranges.bedrooms = { min: criteria.minBedrooms };
  }

  const filters: LeboncoinSearchRequest["filters"] = {
    category: { id: "9" },
    enums,
    ranges,
  };

  if (location.area) {
    filters.location = {
      area: {
        lat: location.area.lat,
        lng: location.area.lng,
        radius: location.area.radius ?? location.area.default_radius,
      },
    };
  } else {
    const text = resolveSearchText(location);
    if (text) {
      filters.keywords = { text };
    }
  }

  return {
    filters,
    limit: pageSize,
    offset: Math.max(0, page - 1) * pageSize,
    owner_type: "all",
    sort_by: "time",
    sort_order: "desc",
  };
}

export function parseLeboncoinSearchResponse(
  response: LeboncoinSearchApiResponse
): {
  ads: LeboncoinAd[];
  totalCount: number;
  maxPages: number;
} {
  const ads = response.ads ?? [];

  return {
    ads,
    totalCount: response.total ?? ads.length,
    maxPages: response.max_pages ?? 1,
  };
}
