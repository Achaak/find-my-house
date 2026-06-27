import type {
  ListingSearchFilters,
  ListingSearchSort,
  ListingSource,
} from "./index.js";

export const LISTING_SOURCES: readonly ListingSource[] = [
  "bienici",
  "leboncoin",
  "seloger",
  "logicimmo",
];

export const LISTING_SEARCH_SORTS: readonly ListingSearchSort[] = [
  "price_asc",
  "price_desc",
  "date_desc",
  "surface_desc",
  "compat_desc",
];

export const LISTING_SEARCH_LIMIT_MAX = 100;
export const LISTING_MAP_LIMIT_MAX = 5_000;

function parseOptionalInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBool(value: unknown): boolean | undefined {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readQueryString(
  query: Record<string, unknown>,
  key: string,
  aliases: string[] = []
): string | undefined {
  const direct = readString(query[key]);
  if (direct) return direct;
  for (const alias of aliases) {
    const aliasValue = readString(query[alias]);
    if (aliasValue) return aliasValue;
  }
  return undefined;
}

function parseListingSource(value: unknown): ListingSource | undefined {
  if (typeof value !== "string") return undefined;
  return LISTING_SOURCES.includes(value as ListingSource)
    ? (value as ListingSource)
    : undefined;
}

export type ParseListingSearchFiltersResult = {
  filters: ListingSearchFilters;
  map: boolean;
  error?: string;
};

export function parseListingSearchFiltersQuery(
  query: Record<string, unknown>
): ParseListingSearchFiltersResult {
  const ancienOnly = parseOptionalBool(query.ancienOnly ?? query.old_only);
  const neufOnly = parseOptionalBool(query.neufOnly ?? query.new_only);

  if (ancienOnly && neufOnly) {
    return {
      filters: {},
      map: false,
      error: "Old and new build filters are mutually exclusive.",
    };
  }

  const sortRaw = readQueryString(query, "sort");
  const sort = LISTING_SEARCH_SORTS.includes(sortRaw as ListingSearchSort)
    ? (sortRaw as ListingSearchSort)
    : undefined;

  const source = parseListingSource(readQueryString(query, "source"));
  const map = parseOptionalBool(query.map) === true;
  const limit = Math.min(
    parseOptionalInt(query.limit) ?? 20,
    map ? LISTING_MAP_LIMIT_MAX : LISTING_SEARCH_LIMIT_MAX
  );
  const offset = Math.max(parseOptionalInt(query.offset) ?? 0, 0);
  const priceDropOnly = parseOptionalBool(
    query.priceDropOnly ?? query.price_drop_only
  );

  return {
    map,
    filters: {
      city: readQueryString(query, "city"),
      postalCode: readQueryString(query, "postalCode", ["postal_code"]),
      text: readQueryString(query, "text"),
      source,
      minPrice: parseOptionalInt(query.minPrice ?? query.min_price),
      maxPrice: parseOptionalInt(query.maxPrice ?? query.max_price),
      minSurface: parseOptionalInt(query.minSurface ?? query.min_surface),
      minLandSurface: parseOptionalInt(query.minLandSurface ?? query.min_land),
      minRooms: parseOptionalInt(query.minRooms ?? query.min_rooms),
      minBedrooms: parseOptionalInt(query.minBedrooms ?? query.min_bedrooms),
      ancienOnly,
      neufOnly,
      maxTravelMinutes: parseOptionalInt(
        query.maxTravelMinutes ?? query.travel_minutes
      ),
      sort: sort ?? "date_desc",
      limit,
      offset,
      priceDropOnly,
    },
  };
}

export function normalizeListingFilters(
  draft: ListingSearchFilters
): ListingSearchFilters {
  const normalized = {
    ...draft,
    city: draft.city?.trim() || undefined,
    postalCode: draft.postalCode?.trim() || undefined,
    text: draft.text?.trim() || undefined,
    minPrice: draft.minPrice,
    maxPrice: draft.maxPrice,
    minSurface: draft.minSurface,
    minLandSurface: draft.minLandSurface,
    minRooms: draft.minRooms,
    minBedrooms: draft.minBedrooms,
    maxTravelMinutes: draft.maxTravelMinutes,
    ancienOnly: draft.ancienOnly || undefined,
    neufOnly: draft.neufOnly || undefined,
    priceDropOnly: draft.priceDropOnly || undefined,
    limit: Math.min(draft.limit ?? 20, LISTING_SEARCH_LIMIT_MAX),
  };
  const { offset: _offset, ...urlFilters } = normalized;
  return urlFilters;
}

export function serializeListingSearchFilters(
  filters: ListingSearchFilters
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (key === "offset") continue;
    if (value === undefined || value === null || value === "") continue;
    params[key] = String(value);
  }
  return params;
}

/** Route search params — excludes offset and map. */
export function searchParamsToListingFilters(
  search: Record<string, unknown>
): ListingSearchFilters {
  const { filters } = parseListingSearchFiltersQuery(search);
  const { offset: _offset, ...urlFilters } = filters;
  return urlFilters;
}
