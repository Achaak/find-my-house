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
