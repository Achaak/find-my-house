import type { PortalListingCriteria } from "../../types/listing.js";
import { httpClient } from "../http/client.js";
import { createLogger } from "../logger.js";
import { fetchBienIciSuggest } from "../bienici/suggest.js";
import { resolveBienIciTravelOrigin } from "../bienici/place.js";
import { bboxCenter, type GeoPoint } from "../geo/geo.js";
import { travelTimeRadiusKm, type GeoFilter } from "../geo/geoFilter.js";
import { getClassifiedPortalHeaders } from "./headers.js";
import type { ClassifiedPlace, ClassifiedPortalConfig } from "./types.js";

function encodeClassifiedLocation(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export async function resolveClassifiedPlace(
  city: string
): Promise<ClassifiedPlace | null> {
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

export async function resolveClassifiedStrtPlaceId(
  portal: ClassifiedPortalConfig,
  center: GeoPoint
): Promise<string | null> {
  const url = new URL(`${portal.baseUrl}/serp-bff/places/point/place-id`);
  url.searchParams.set("lng", String(center.lng));
  url.searchParams.set("lat", String(center.lat));
  url.searchParams.set("typeKey", "STRT");

  const response = await httpClient(url.toString(), {
    headers: getClassifiedPortalHeaders(portal, "json"),
    throwHttpErrors: false,
  });
  if (response.statusCode !== 200) return null;

  const text = response.body.trim();
  if (!text || text.startsWith("{")) return null;

  return text.replace(/^"|"$/g, "");
}

export function buildClassifiedTravelLocation(
  strtPlaceId: string,
  durationMinutes: number
): string {
  return encodeClassifiedLocation({
    placeIds: [strtPlaceId],
    duration: String(durationMinutes),
    mode: "Car",
  });
}

export function buildClassifiedRadiusLocation(
  place: ClassifiedPlace,
  radiusKm: number,
  center: GeoPoint = place.center
): string {
  return encodeClassifiedLocation({
    placeId: place.locationCode,
    radius: radiusKm,
    coordinates: { lat: center.lat, lng: center.lng },
  });
}

export async function buildClassifiedLocation(
  portal: ClassifiedPortalConfig,
  city: string,
  place: ClassifiedPlace,
  geoFilter: GeoFilter
): Promise<string> {
  const log = createLogger(portal.id);

  if (geoFilter.mode === "travel") {
    const origin = (await resolveBienIciTravelOrigin(city)) ?? {
      address: place.name,
      center: place.center,
    };
    const strtPlaceId = await resolveClassifiedStrtPlaceId(
      portal,
      origin.center
    );
    if (strtPlaceId) {
      return buildClassifiedTravelLocation(
        strtPlaceId,
        geoFilter.maxTravelMinutes
      );
    }

    const radiusKm = travelTimeRadiusKm(geoFilter.maxTravelMinutes);
    log.warn(
      `point STRT indisponible pour "${city}", repli sur rayon estimé (~${String(Math.round(radiusKm))} km)`
    );
    return buildClassifiedRadiusLocation(place, radiusKm, origin.center);
  }

  if (geoFilter.mode === "radius") {
    return buildClassifiedRadiusLocation(place, geoFilter.radiusKm);
  }

  return place.locationCode;
}

export function buildClassifiedSearchUrl(
  portal: ClassifiedPortalConfig,
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

  return `${portal.baseUrl}/classified-search?${params.toString()}`;
}
