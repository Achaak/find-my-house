import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../bienici/place.js";
import type { GeoPoint } from "./geo.js";

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
): Promise<{ center: GeoPoint; placeName: string; zipcode?: string } | null> {
  const place = await resolveBienIciPlace(city, postalCode);
  if (!place) return null;

  const origin = await resolveBienIciTravelOrigin(city, postalCode);
  return {
    center: origin?.center ?? place.center,
    placeName: place.name,
    zipcode: postalCode ?? resolvePostalCode(place.name, place.postalCodes),
  };
}
