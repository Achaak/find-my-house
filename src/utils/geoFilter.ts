import type { ScrapeFilters } from "../types/listing.js";

export type GeoFilterMode = "travel" | "radius" | "city";

export type GeoFilter =
  | { mode: "travel"; maxTravelMinutes: number }
  | { mode: "radius"; radiusKm: number }
  | { mode: "city" };

type GeoFilterOptions = Pick<ScrapeFilters, "maxTravelMinutes" | "radiusKm">;

/**
 * Résout le filtre géographique à appliquer pour un scraper.
 * Le temps de trajet est prioritaire sur le rayon quand le scraper le supporte.
 */
export function resolveGeoFilter(
  options: GeoFilterOptions,
  supportsTravelTime = true
): GeoFilter {
  if (supportsTravelTime && options.maxTravelMinutes !== undefined) {
    return { mode: "travel", maxTravelMinutes: options.maxTravelMinutes };
  }

  if (options.radiusKm !== undefined) {
    return { mode: "radius", radiusKm: options.radiusKm };
  }

  return { mode: "city" };
}

export function geoFilterLabel(filter: GeoFilter): string {
  if (filter.mode === "travel") {
    return `${String(filter.maxTravelMinutes)} min en voiture`;
  }
  if (filter.mode === "radius") {
    return `rayon ${String(filter.radiusKm)} km`;
  }
  return "ville";
}
