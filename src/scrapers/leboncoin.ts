import { scrapeConfig } from "../config/scrape.js";
import type { Listing } from "../types/listing.js";
import {
  buildLeboncoinAreaLocation,
  fetchLeboncoinAds,
  mapLeboncoinAdToListing,
  resolveLeboncoinPlace,
} from "../utils/leboncoin/index.js";
import { isWithinRadiusKm, type GeoPoint } from "../utils/geo/geo.js";
import { resolveScraperGeoFilter } from "../utils/geo/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geo/geocode.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class LeboncoinScraper implements Scraper {
  readonly name = "leboncoin";
  readonly supportsTravelTime = false;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveLeboncoinPlace(options.city, options.postalCode);
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
          ? ((await resolveGeoSearchCenter(options.city, options.postalCode))
              ?.center ?? place.center)
          : place.center;
      searchLocation = buildLeboncoinAreaLocation(
        place,
        geoFilter.radiusKm,
        searchCenter
      );
      radiusFilter = { center: searchCenter, radiusKm: geoFilter.radiusKm };
    }

    let allAds = await fetchLeboncoinAds(
      options,
      searchLocation,
      scrapeConfig.scrape.maxPages
    );

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
