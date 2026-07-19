import type { ListingSearchFilters } from "@find-my-house/api-types";
import { normalizeListingFilters as normalizeListingFiltersShared } from "@find-my-house/api-types";
import { formatLocaleNumber } from "@/lib/locale";
import * as m from "@/paraglide/messages.js";

export {
  LISTING_SOURCES,
  searchParamsToListingFilters as searchParamsToFilters,
  serializeListingSearchFilters as filtersToSearchParams,
} from "@find-my-house/api-types";

export const normalizeListingFilters = normalizeListingFiltersShared;

export function formatBrowseCriteria(
  criteria: ListingSearchFilters,
  zoneLabel?: string
): string {
  const parts: string[] = [];
  if (criteria.city) parts.push(criteria.city);
  if (zoneLabel) parts.push(zoneLabel);
  if (criteria.postalCode) {
    parts.push(m.browse_criteria_postal({ code: criteria.postalCode }));
  }
  if (criteria.maxPrice !== undefined) {
    parts.push(
      m.browse_criteria_max_price({
        price: formatLocaleNumber(criteria.maxPrice),
      })
    );
  }
  if (criteria.minSurface !== undefined) {
    parts.push(
      m.browse_criteria_min_surface({ surface: String(criteria.minSurface) })
    );
  }
  if (criteria.minLandSurface !== undefined) {
    parts.push(
      m.browse_criteria_min_land({ land: String(criteria.minLandSurface) })
    );
  }
  if (criteria.ancienOnly) parts.push(m.browse_criteria_ancien());
  if (criteria.neufOnly) parts.push(m.browse_criteria_neuf());
  return parts.length > 0 ? parts.join(" · ") : m.browse_criteria_default();
}

export type FilterChip = {
  key: string;
  label: string;
};

export function formatFilterChips(filters: ListingSearchFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.city) chips.push({ key: "city", label: filters.city });
  if (filters.postalCode) {
    chips.push({ key: "postalCode", label: filters.postalCode });
  }
  if (filters.text) {
    chips.push({ key: "text", label: filters.text });
  }
  if (filters.maxPrice !== undefined) {
    chips.push({
      key: "maxPrice",
      label: m.browse_criteria_max_price({
        price: formatLocaleNumber(filters.maxPrice),
      }),
    });
  }
  if (filters.minPrice !== undefined) {
    chips.push({
      key: "minPrice",
      label: m.filter_min_price_chip({
        price: formatLocaleNumber(filters.minPrice),
      }),
    });
  }
  if (filters.minSurface !== undefined) {
    chips.push({
      key: "minSurface",
      label: m.browse_criteria_min_surface({
        surface: String(filters.minSurface),
      }),
    });
  }
  if (filters.minLandSurface !== undefined) {
    chips.push({
      key: "minLandSurface",
      label: m.browse_criteria_min_land({
        land: String(filters.minLandSurface),
      }),
    });
  }
  if (filters.minRooms !== undefined) {
    chips.push({
      key: "minRooms",
      label: m.filter_min_rooms_chip({ count: filters.minRooms }),
    });
  }
  if (filters.minBedrooms !== undefined) {
    chips.push({
      key: "minBedrooms",
      label: m.filter_min_bedrooms_chip({ count: filters.minBedrooms }),
    });
  }
  if (filters.maxTravelMinutes !== undefined) {
    chips.push({
      key: "maxTravelMinutes",
      label: m.filter_max_travel_chip({
        minutes: filters.maxTravelMinutes,
      }),
    });
  }
  if (filters.source) {
    chips.push({ key: "source", label: filters.source });
  }
  if (filters.priceDropOnly) {
    chips.push({ key: "priceDrop", label: m.filter_price_drop_only() });
  }
  if (filters.ancienOnly)
    chips.push({ key: "ancien", label: m.filter_ancien_only() });
  if (filters.neufOnly)
    chips.push({ key: "neuf", label: m.filter_neuf_only() });
  return chips;
}

export function clearFilterChip(
  filters: ListingSearchFilters,
  key: string
): ListingSearchFilters {
  const next = { ...filters };
  switch (key) {
    case "city":
      delete next.city;
      break;
    case "postalCode":
      delete next.postalCode;
      break;
    case "text":
      delete next.text;
      break;
    case "maxPrice":
      delete next.maxPrice;
      break;
    case "minPrice":
      delete next.minPrice;
      break;
    case "minSurface":
      delete next.minSurface;
      break;
    case "minLandSurface":
      delete next.minLandSurface;
      break;
    case "minRooms":
      delete next.minRooms;
      break;
    case "minBedrooms":
      delete next.minBedrooms;
      break;
    case "maxTravelMinutes":
      delete next.maxTravelMinutes;
      break;
    case "source":
      delete next.source;
      break;
    case "priceDrop":
      next.priceDropOnly = false;
      break;
    case "ancien":
      next.ancienOnly = false;
      break;
    case "neuf":
      next.neufOnly = false;
      break;
  }
  return next;
}
