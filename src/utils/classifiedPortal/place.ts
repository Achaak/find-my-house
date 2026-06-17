import type { PortalListingCriteria } from "../../types/listing.js";
import { browserPageFetch } from "../browser/client.js";
import { createLogger } from "../logger.js";
import { fetchBienIciSuggest } from "../bienici/suggest.js";
import { pickSuggestResult } from "../bienici/pickSuggestResult.js";
import { resolveBienIciTravelOrigin } from "../bienici/place.js";
import { bboxCenter, type GeoPoint } from "../geo/geo.js";
import { type GeoFilter, travelTimeRadiusKm } from "../geo/geoFilter.js";
import type { ClassifiedPlace, ClassifiedPortalConfig } from "./types.js";

function encodeClassifiedLocation(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function slugifyClassifiedCity(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function departmentFromClassifiedLocationCode(
  locationCode: string
): string {
  const insee = locationCode.replace(/^AD08FR/i, "");
  if (/^2[AB]/i.test(insee)) return insee.slice(0, 2).toUpperCase();
  return insee.slice(0, 2);
}

/** SEO listing URL — SSR includes UFRN data (works with CloakBrowser; classified-search often does not). */
export function buildClassifiedSeoSearchUrl(
  portal: ClassifiedPortalConfig,
  place: ClassifiedPlace,
  page = 1
): string {
  const slug = slugifyClassifiedCity(place.name);
  const department = departmentFromClassifiedLocationCode(place.locationCode);
  const base = `${portal.baseUrl}/immobilier/achat/immo-${slug}-${department}/bien-maison/`;
  if (page <= 1) return base;
  return `${base}?LISTING-LISTpg=${String(page)}`;
}

export function isClassifiedSeoSearchUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes("/immobilier/");
  } catch {
    return false;
  }
}

/** Plain AD08FR… place id (commune), not a base64 radius/travel payload. */
export function isCityOnlyClassifiedLocation(location: string): boolean {
  return location.startsWith("AD08FR");
}

export async function resolveClassifiedPlace(
  city: string,
  postalCode?: string
): Promise<ClassifiedPlace | null> {
  const results = await fetchBienIciSuggest(city);
  const match = pickSuggestResult(results, city, postalCode);

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

  const response = await browserPageFetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "Accept-Language": "fr-FR,fr;q=0.9",
    },
    warmUpOrigin: `${portal.baseUrl}/`,
  });
  if (response.status !== 200) return null;

  const text = response.body.trim();
  if (!text || text.startsWith("{")) return null;

  return text.replace(/^"|"$/g, "");
}

/** Durations offered by SeLoger / Logic-Immo travel-time search (minutes by car). */
export const CLASSIFIED_TRAVEL_MINUTE_OPTIONS = [
  5, 10, 15, 20, 25, 30, 45, 60,
] as const;

/** Smallest portal-supported travel time >= requested (for search radius). */
export function ceilClassifiedTravelMinutes(minutes: number): number {
  if (
    (CLASSIFIED_TRAVEL_MINUTE_OPTIONS as readonly number[]).includes(minutes)
  ) {
    return minutes;
  }

  const ceiling = CLASSIFIED_TRAVEL_MINUTE_OPTIONS.find(
    (option) => option >= minutes
  );
  return (
    ceiling ??
    CLASSIFIED_TRAVEL_MINUTE_OPTIONS[
      CLASSIFIED_TRAVEL_MINUTE_OPTIONS.length - 1
    ]
  );
}

export function buildClassifiedTravelLocation(
  strtPlaceId: string,
  durationMinutes: number
): string {
  const duration = ceilClassifiedTravelMinutes(durationMinutes);
  return encodeClassifiedLocation({
    placeIds: [strtPlaceId],
    duration: String(duration),
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

export function resolveClassifiedLocation(
  place: ClassifiedPlace,
  geoFilter: GeoFilter,
  options: {
    strtPlaceId: string | null;
    origin: GeoPoint;
  }
): string {
  if (geoFilter.mode === "travel") {
    if (options.strtPlaceId) {
      return buildClassifiedTravelLocation(
        options.strtPlaceId,
        geoFilter.maxTravelMinutes
      );
    }

    return buildClassifiedRadiusLocation(
      place,
      travelTimeRadiusKm(
        ceilClassifiedTravelMinutes(geoFilter.maxTravelMinutes)
      ),
      options.origin
    );
  }

  if (geoFilter.mode === "radius") {
    return buildClassifiedRadiusLocation(
      place,
      geoFilter.radiusKm,
      options.origin
    );
  }

  return place.locationCode;
}

export async function buildClassifiedLocation(
  portal: ClassifiedPortalConfig,
  city: string,
  place: ClassifiedPlace,
  geoFilter: GeoFilter,
  postalCode?: string
): Promise<string> {
  const log = createLogger(portal.id);
  const origin = (await resolveBienIciTravelOrigin(city, postalCode)) ?? {
    address: place.name,
    center: place.center,
  };

  const strtPlaceId =
    geoFilter.mode === "travel"
      ? ((await resolveClassifiedStrtPlaceId(portal, place.center)) ??
        (await resolveClassifiedStrtPlaceId(portal, origin.center)))
      : null;

  if (geoFilter.mode === "travel" && !strtPlaceId) {
    const searchMinutes = ceilClassifiedTravelMinutes(
      geoFilter.maxTravelMinutes
    );
    const radiusKm = travelTimeRadiusKm(searchMinutes);
    log.warn(
      `STRT place unavailable for "${city}", falling back to estimated radius (~${String(Math.round(radiusKm))} km)`
    );
  }

  if (geoFilter.mode === "travel" && strtPlaceId) {
    const searchMinutes = ceilClassifiedTravelMinutes(
      geoFilter.maxTravelMinutes
    );
    if (searchMinutes !== geoFilter.maxTravelMinutes) {
      log.info(
        `${String(geoFilter.maxTravelMinutes)} min filter → ${String(searchMinutes)} min search (${portal.label}: ${CLASSIFIED_TRAVEL_MINUTE_OPTIONS.join(", ")})`
      );
    }
  }

  return resolveClassifiedLocation(place, geoFilter, {
    strtPlaceId,
    origin: origin.center,
  });
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
