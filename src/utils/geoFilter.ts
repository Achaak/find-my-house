import type { ScrapeFilters } from "../types/listing.js";
import type { GeoPoint } from "./geo.js";

export type GeoFilterMode = "travel" | "radius" | "city";

export type GeoFilter =
  | { mode: "travel"; maxTravelMinutes: number }
  | { mode: "radius"; radiusKm: number }
  | { mode: "city" };

type GeoFilterOptions = Pick<ScrapeFilters, "maxTravelMinutes" | "radiusKm">;

/**
 * Resolves the geographic filter to apply for a scraper.
 * Travel time takes priority over radius when the scraper supports it.
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

/**
 * Geo filter for a scraper. Portals without isochrone API use an estimated
 * driving radius when travel time is requested.
 */
export function resolveScraperGeoFilter(
  options: GeoFilterOptions,
  supportsTravelTime: boolean
): GeoFilter {
  if (options.maxTravelMinutes !== undefined && !supportsTravelTime) {
    return {
      mode: "radius",
      radiusKm: travelTimeRadiusKm(options.maxTravelMinutes),
    };
  }

  return resolveGeoFilter(options, supportsTravelTime);
}

export function resolveScraperGeoFilterLabel(
  options: GeoFilterOptions,
  supportsTravelTime: boolean
): string {
  if (options.maxTravelMinutes !== undefined && !supportsTravelTime) {
    const radiusKm = travelTimeRadiusKm(options.maxTravelMinutes);
    return `${String(options.maxTravelMinutes)} min en voiture (~${String(Math.round(radiusKm))} km)`;
  }

  return geoFilterLabel(resolveGeoFilter(options, supportsTravelTime));
}

export type RadiusSearchFilter = {
  center: GeoPoint;
  radiusKm: number;
};

/** Unified lat/lng radius for DB search (travel time → estimated driving radius). */
export function resolveRadiusSearchFilter(
  geoFilter: GeoFilter,
  center: GeoPoint
): RadiusSearchFilter | null {
  if (geoFilter.mode === "travel") {
    return {
      center,
      radiusKm: travelTimeRadiusKm(geoFilter.maxTravelMinutes),
    };
  }

  if (geoFilter.mode === "radius") {
    return { center, radiusKm: geoFilter.radiusKm };
  }

  return null;
}

/** Rough driving radius (km) when Bien'ici travel-time API is unavailable. */
export function travelTimeRadiusKm(travelMinutes: number): number {
  return estimateDrivingRadiusKm(travelMinutes);
}

/** @deprecated Use travelTimeRadiusKm */
export function estimateDrivingRadiusKm(travelMinutes: number): number {
  const AVG_SPEED_KMH = 50;
  return (travelMinutes / 60) * AVG_SPEED_KMH;
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
