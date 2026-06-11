import type { Listing } from "../types/listing.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo.js";
import { resolveScraperGeoFilter } from "../utils/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geocode.js";
import {
  buildLeboncoinAreaLocation,
  buildLeboncoinSearchBody,
  fetchLeboncoinAds,
  resolveLeboncoinPlace,
} from "../utils/leboncoinApi.js";
import { mapLeboncoinAdToListing } from "../utils/mappers/leboncoin.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class LeboncoinScraper implements Scraper {
  readonly name = "leboncoin";
  readonly supportsTravelTime = false;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveLeboncoinPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur LeBonCoin`
      );
    }

    const geoFilter = resolveScraperGeoFilter(options, false);
    let searchLocation = place.location;
    let radiusFilter: { center: GeoPoint; radiusKm: number } | null = null;

    if (geoFilter.mode === "radius") {
      const searchCenter =
        options.maxTravelMinutes !== undefined
          ? ((await resolveGeoSearchCenter(options.city))?.center ??
            place.center)
          : place.center;
      searchLocation = buildLeboncoinAreaLocation(
        place,
        geoFilter.radiusKm,
        searchCenter
      );
      radiusFilter = { center: searchCenter, radiusKm: geoFilter.radiusKm };
    }

    const body = buildLeboncoinSearchBody(options, searchLocation);
    let allAds = await fetchLeboncoinAds(body);

    if (radiusFilter) {
      const { center, radiusKm } = radiusFilter;
      allAds = allAds.filter((ad) =>
        isWithinRadiusKm(
          { lat: ad.location.lat, lng: ad.location.lng },
          center,
          radiusKm
        )
      );
    }
    const scrapedAt = new Date().toISOString();

    return allAds.map((ad) =>
      mapLeboncoinAdToListing(ad, scrapedAt, place.name)
    );
  }
}
