import type { ListingSearchFilters } from "@find-my-house/api-types";
import { formatLocaleNumber } from "@/lib/locale";
import { parseOptionalNumber } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function filtersToSearchParams(
  filters: ListingSearchFilters
): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = String(value);
  }
  return params;
}

export function searchParamsToFilters(
  search: Record<string, unknown>
): ListingSearchFilters {
  const readString = (key: string) => {
    const value = search[key];
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  };

  const readBool = (key: string) => {
    const value = search[key];
    if (value === true || value === "true" || value === "1") return true;
    return undefined;
  };

  return {
    city: readString("city"),
    postalCode: readString("postalCode"),
    text: readString("text"),
    source: readString("source") as ListingSearchFilters["source"],
    minPrice: parseOptionalNumber(String(search.minPrice ?? "")),
    maxPrice: parseOptionalNumber(String(search.maxPrice ?? "")),
    minSurface: parseOptionalNumber(String(search.minSurface ?? "")),
    minLandSurface: parseOptionalNumber(String(search.minLandSurface ?? "")),
    minRooms: parseOptionalNumber(String(search.minRooms ?? "")),
    minBedrooms: parseOptionalNumber(String(search.minBedrooms ?? "")),
    maxTravelMinutes: parseOptionalNumber(
      String(search.maxTravelMinutes ?? "")
    ),
    ancienOnly: readBool("ancienOnly"),
    neufOnly: readBool("neufOnly"),
    priceDropOnly: readBool("priceDropOnly"),
    sort: (readString("sort") as ListingSearchFilters["sort"]) ?? "date_desc",
    limit: parseOptionalNumber(String(search.limit ?? "")) ?? 20,
  };
}

export function normalizeListingFilters(
  draft: ListingSearchFilters
): ListingSearchFilters {
  return {
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
    limit: draft.limit ?? 20,
  };
}

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
