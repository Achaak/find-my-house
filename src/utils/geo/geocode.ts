import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../bienici/place.js";
import type { GeoPoint } from "./geo.js";

/** Center for radius / travel-time search (travel origin when available). */
export async function resolveGeoSearchCenter(
  city: string
): Promise<{ center: GeoPoint; placeName: string } | null> {
  const place = await resolveBienIciPlace(city);
  if (!place) return null;

  const origin = await resolveBienIciTravelOrigin(city);
  return {
    center: origin?.center ?? place.center,
    placeName: place.name,
  };
}
