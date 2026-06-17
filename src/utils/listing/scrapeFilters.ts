import type {
  ListingSearchFilters,
  ScrapeFilters,
} from "../../types/listing.js";

/** Map scrape defaults to listing search filters (browse, API). */
export function scrapeFiltersToSearch(
  filters: ScrapeFilters
): ListingSearchFilters {
  return {
    city: filters.city,
    postalCode: filters.postalCode,
    maxPrice: filters.maxPrice,
    minSurface: filters.minSurface,
    minLandSurface: filters.minLandSurface,
    minRooms: filters.minRooms,
    minBedrooms: filters.minBedrooms,
    ancienOnly: filters.ancienOnly,
    maxTravelMinutes: filters.maxTravelMinutes,
  };
}
