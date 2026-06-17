import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../bienici/place.js";
import type { GeoPoint } from "./geo.js";

export type GeoSearchCenter = {
  center: GeoPoint;
  placeName: string;
  zipcode?: string;
};

const geoSearchCenterCache = new Map<string, GeoSearchCenter | null>();

function geoSearchCenterCacheKey(city: string, postalCode?: string): string {
  return `${city.trim().toLowerCase()}|${postalCode?.trim() ?? ""}`;
}

/** Clears the in-memory geocode cache (tests). */
export function clearGeoSearchCenterCache(): void {
  geoSearchCenterCache.clear();
}

function resolvePostalCode(
  placeName: string,
  postalCodes?: string[]
): string | undefined {
  return postalCodes?.[0] ?? /\((\d{5})\)/.exec(placeName)?.[1];
}

/** Center for radius / travel-time search (travel origin when available). */
export async function resolveGeoSearchCenter(
  city: string,
  postalCode?: string
): Promise<GeoSearchCenter | null> {
  const cacheKey = geoSearchCenterCacheKey(city, postalCode);
  if (geoSearchCenterCache.has(cacheKey)) {
    return geoSearchCenterCache.get(cacheKey) ?? null;
  }

  const place = await resolveBienIciPlace(city, postalCode);
  if (!place) {
    geoSearchCenterCache.set(cacheKey, null);
    return null;
  }

  const origin = await resolveBienIciTravelOrigin(city, postalCode);
  const resolved: GeoSearchCenter = {
    center: origin?.center ?? place.center,
    placeName: place.name,
    zipcode: postalCode ?? resolvePostalCode(place.name, place.postalCodes),
  };
  geoSearchCenterCache.set(cacheKey, resolved);
  return resolved;
}
