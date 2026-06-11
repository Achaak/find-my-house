import type { Listing } from "../types/listing.js";
import {
  buildBienIciSearchFilters,
  computeBienIciTravelZone,
  fetchBienIciAds,
  type BienIciZoneIdsByTypes,
} from "../utils/bieniciApi.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo.js";
import { resolveGeoFilter, travelTimeRadiusKm } from "../utils/geoFilter.js";
import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../utils/geocode.js";
import {
  extractBienIciAdCoords,
  mapBienIciAdToListing,
  type BienIciAd,
} from "../utils/mappers/bienici.js";
import type { Scraper, ScraperOptions } from "./types.js";

type TravelRadiusFallback = {
  center: GeoPoint;
  radiusKm: number;
};

async function resolveZoneIdsByTypes(
  options: ScraperOptions,
  place: NonNullable<Awaited<ReturnType<typeof resolveBienIciPlace>>>
): Promise<{
  zoneIdsByTypes: BienIciZoneIdsByTypes;
  travelRadiusFallback: TravelRadiusFallback | null;
}> {
  const geoFilter = resolveGeoFilter(options, true);

  if (geoFilter.mode === "travel") {
    const origin = (await resolveBienIciTravelOrigin(options.city)) ?? {
      center: place.center,
      address: place.name,
    };

    try {
      const zoneId = await computeBienIciTravelZone({
        center: origin.center,
        address: origin.address,
        durationMinutes: geoFilter.maxTravelMinutes,
      });
      return {
        zoneIdsByTypes: { travelTimeZone: [zoneId] },
        travelRadiusFallback: null,
      };
    } catch (error) {
      const radiusKm = travelTimeRadiusKm(geoFilter.maxTravelMinutes);
      console.warn(
        `[scraper] bienici — zone-by-time indisponible, repli sur rayon estimé (~${String(Math.round(radiusKm))} km):`,
        error
      );
      const zoneIds =
        place.departmentZoneIds.length > 0
          ? place.departmentZoneIds
          : place.cityZoneIds;
      return {
        zoneIdsByTypes: { zoneIds },
        travelRadiusFallback: { center: origin.center, radiusKm },
      };
    }
  }

  if (geoFilter.mode === "radius") {
    const zoneIds =
      place.departmentZoneIds.length > 0
        ? place.departmentZoneIds
        : place.cityZoneIds;
    return { zoneIdsByTypes: { zoneIds }, travelRadiusFallback: null };
  }

  return {
    zoneIdsByTypes: { zoneIds: place.cityZoneIds },
    travelRadiusFallback: null,
  };
}

export class BienIciScraper implements Scraper {
  readonly name = "bienici";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveBienIciPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur BienIci`
      );
    }

    const geoFilter = resolveGeoFilter(options, true);
    const { zoneIdsByTypes, travelRadiusFallback } =
      await resolveZoneIdsByTypes(options, place);

    if (
      !zoneIdsByTypes.zoneIds?.length &&
      !zoneIdsByTypes.travelTimeZone?.length
    ) {
      throw new Error(`Aucune zone BienIci trouvée pour "${options.city}"`);
    }

    const filters = buildBienIciSearchFilters(options, zoneIdsByTypes);
    let allAds = await fetchBienIciAds<BienIciAd>(filters);
    const scrapedAt = new Date().toISOString();

    if (travelRadiusFallback) {
      const { center, radiusKm } = travelRadiusFallback;
      allAds = allAds.filter((ad) => {
        const coords = extractBienIciAdCoords(ad);
        return coords !== null && isWithinRadiusKm(coords, center, radiusKm);
      });
    } else if (geoFilter.mode === "radius") {
      const radiusKm = geoFilter.radiusKm;
      allAds = allAds.filter((ad) => {
        const coords = extractBienIciAdCoords(ad);
        return (
          coords !== null && isWithinRadiusKm(coords, place.center, radiusKm)
        );
      });
    }

    return allAds.map((ad) => mapBienIciAdToListing(ad, scrapedAt, place.name));
  }
}
