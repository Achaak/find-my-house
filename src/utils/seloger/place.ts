import got from "got";
import type { PortalListingCriteria } from "../../types/listing.js";
import { fetchBienIciSuggest } from "../bieniciSuggest.js";
import { bboxCenter, type GeoPoint } from "../geo.js";
import { resolveBienIciTravelOrigin } from "../geocode.js";
import { travelTimeRadiusKm, type GeoFilter } from "../geoFilter.js";
import { getSeLogerHeaders } from "./headers.js";
import { BASE_URL, type SeLogerPlace } from "./types.js";

function encodeSeLogerLocation(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/** Resolves a city to a SeLoger place code (e.g. AD08FR76382). */
export async function resolveSeLogerPlace(
  city: string
): Promise<SeLogerPlace | null> {
  const results = await fetchBienIciSuggest(city);
  const cityLower = city.trim().toLowerCase();
  const match =
    results.find(
      (r) => r.insee_code && r.boundingBox && r.name.toLowerCase() === cityLower
    ) ?? results.find((r) => r.insee_code && r.boundingBox);

  if (!match?.insee_code || !match.boundingBox) return null;

  return {
    name: match.name,
    center: bboxCenter(match.boundingBox),
    locationCode: `AD08FR${match.insee_code}`,
  };
}

/** STRT origin point (e.g. STRTFR4383444) for travel-time filtering. */
export async function resolveSeLogerStrtPlaceId(
  center: GeoPoint
): Promise<string | null> {
  const url = new URL(`${BASE_URL}/serp-bff/places/point/place-id`);
  url.searchParams.set("lng", String(center.lng));
  url.searchParams.set("lat", String(center.lat));
  url.searchParams.set("typeKey", "STRT");

  const response = await got(url.toString(), {
    headers: getSeLogerHeaders("json"),
    throwHttpErrors: false,
  });
  if (response.statusCode !== 200) return null;

  const text = response.body.trim();
  if (!text || text.startsWith("{")) return null;

  return text.replace(/^"|"$/g, "");
}

export function buildSeLogerTravelLocation(
  strtPlaceId: string,
  durationMinutes: number
): string {
  return encodeSeLogerLocation({
    placeIds: [strtPlaceId],
    duration: String(durationMinutes),
    mode: "Car",
  });
}

export function buildSeLogerRadiusLocation(
  place: SeLogerPlace,
  radiusKm: number,
  center: GeoPoint = place.center
): string {
  return encodeSeLogerLocation({
    placeId: place.locationCode,
    radius: radiusKm,
    coordinates: { lat: center.lat, lng: center.lng },
  });
}

export async function buildSeLogerLocation(
  city: string,
  place: SeLogerPlace,
  geoFilter: GeoFilter
): Promise<string> {
  if (geoFilter.mode === "travel") {
    const origin = (await resolveBienIciTravelOrigin(city)) ?? {
      address: place.name,
      center: place.center,
    };
    const strtPlaceId = await resolveSeLogerStrtPlaceId(origin.center);
    if (strtPlaceId) {
      return buildSeLogerTravelLocation(
        strtPlaceId,
        geoFilter.maxTravelMinutes
      );
    }

    const radiusKm = travelTimeRadiusKm(geoFilter.maxTravelMinutes);
    console.warn(
      `[seloger] point STRT indisponible pour "${city}", repli sur rayon estimé (~${String(Math.round(radiusKm))} km)`
    );
    return buildSeLogerRadiusLocation(place, radiusKm, origin.center);
  }

  if (geoFilter.mode === "radius") {
    return buildSeLogerRadiusLocation(place, geoFilter.radiusKm);
  }

  return place.locationCode;
}

export function buildSeLogerSearchUrl(
  criteria: PortalListingCriteria,
  location: string,
  page = 1
): string {
  const params = new URLSearchParams();
  params.set("distributionTypes", "Buy");
  params.set("estateTypes", "House");
  params.set("locations", location);

  if (criteria.maxPrice !== undefined) {
    params.set("priceMax", String(criteria.maxPrice));
  }
  if (criteria.minSurface !== undefined) {
    params.set("spaceMin", String(criteria.minSurface));
  }
  if (criteria.minLandSurface !== undefined) {
    params.set("plotSpaceMin", String(criteria.minLandSurface));
  }
  if (criteria.minRooms !== undefined) {
    params.set("numberOfRoomsMin", String(criteria.minRooms));
  }
  if (criteria.minBedrooms !== undefined) {
    params.set("numberOfBedroomsMin", String(criteria.minBedrooms));
  }
  if (criteria.ancienOnly) {
    params.set("projectTypes", "Resale");
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  return `${BASE_URL}/classified-search?${params.toString()}`;
}
