import { scrapeConfig } from "../config/scrape.js";
import type { Listing } from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import {
  buildBienIciSearchFilters,
  computeBienIciTravelZone,
  extractBienIciAdCoords,
  fetchBienIciAds,
  mapBienIciAdToListing,
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
  type BienIciAd,
  type BienIciZoneIdsByTypes,
} from "../utils/bienici/index.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo/geo.js";
import {
  resolveGeoFilter,
  travelTimeRadiusKm,
} from "../utils/geo/geoFilter.js";
import type { Scraper, ScraperOptions } from "./types.js";

const log = createLogger("scraper");

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
      log.warn(
        `bienici — zone-by-time unavailable, falling back to estimated radius (~${String(Math.round(radiusKm))} km):`,
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

  return {
    zoneIdsByTypes: { zoneIds: place.cityZoneIds },
    travelRadiusFallback: null,
  };
}

export class BienIciScraper implements Scraper {
  readonly name = "bienici";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveBienIciPlace(options.city, options.postalCode);
    if (!place) {
      throw new Error(`Unable to geolocate "${options.city}" on BienIci`);
    }

    const { zoneIdsByTypes, travelRadiusFallback } =
      await resolveZoneIdsByTypes(options, place);

    if (
      !zoneIdsByTypes.zoneIds?.length &&
      !zoneIdsByTypes.travelTimeZone?.length
    ) {
      throw new Error(`No BienIci zone found for "${options.city}"`);
    }

    const filters = buildBienIciSearchFilters(options, zoneIdsByTypes);
    let allAds = await fetchBienIciAds<BienIciAd>(
      filters,
      scrapeConfig.scrape.maxPages
    );
    const scrapedAt = new Date().toISOString();

    if (travelRadiusFallback) {
      const { center, radiusKm } = travelRadiusFallback;
      allAds = allAds.filter((ad) => {
        const coords = extractBienIciAdCoords(ad);
        return coords !== null && isWithinRadiusKm(coords, center, radiusKm);
      });
    }

    return allAds.map((ad) => mapBienIciAdToListing(ad, scrapedAt, place.name));
  }
}
