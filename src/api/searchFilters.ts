import type {
  ListingSearchFilters,
  ListingSearchSort,
} from "../types/listing.js";
import { parseListingSource } from "../utils/listingValidation.js";

function parseOptionalInt(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

const SORT_VALUES: ListingSearchSort[] = [
  "price_asc",
  "price_desc",
  "date_desc",
  "surface_desc",
  "compat_desc",
];

function parseOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

export function parseListingSearchFilters(
  query: Record<string, string | undefined>
): { filters: ListingSearchFilters; error?: string } {
  const ancienOnly = parseOptionalBool(query.ancienOnly ?? query.old_only);
  const neufOnly = parseOptionalBool(query.neufOnly ?? query.new_only);

  if (ancienOnly && neufOnly) {
    return {
      filters: {},
      error: "Old and new build filters are mutually exclusive.",
    };
  }

  const sortRaw = query.sort;
  const sort = SORT_VALUES.includes(sortRaw as ListingSearchSort)
    ? (sortRaw as ListingSearchSort)
    : undefined;

  const sourceRaw = query.source;
  const source = sourceRaw
    ? (parseListingSource(sourceRaw) ?? undefined)
    : undefined;

  const limit = Math.min(parseOptionalInt(query.limit) ?? 20, 100);
  const offset = Math.max(parseOptionalInt(query.offset) ?? 0, 0);
  const priceDropOnly = parseOptionalBool(
    query.priceDropOnly ?? query.price_drop_only
  );

  return {
    filters: {
      city: parseOptionalString(query.city),
      postalCode:
        parseOptionalString(query.postalCode) ??
        parseOptionalString(query.postal_code),
      text: parseOptionalString(query.text),
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
      sort,
      limit,
      offset,
      priceDropOnly,
    },
  };
}
