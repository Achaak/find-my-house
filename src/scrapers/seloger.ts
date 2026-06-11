import type { Listing } from "../types/listing.js";
import { resolveGeoFilter } from "../utils/geoFilter.js";
import { mapSeLogerCardToListing } from "../utils/mappers/seloger.js";
import {
  applySeLogerSearchMetadata,
  buildSeLogerLocation,
  buildSeLogerSearchUrl,
  fetchSeLogerClassifieds,
  resolveSeLogerPlace,
} from "../utils/selogerApi.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class SeLogerScraper implements Scraper {
  readonly name = "seloger";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveSeLogerPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur SeLoger`
      );
    }

    const geoFilter = resolveGeoFilter(options, true);
    const location = await buildSeLogerLocation(options.city, place, geoFilter);
    const searchUrl = buildSeLogerSearchUrl(options, location);
    const cards = (await fetchSeLogerClassifieds(searchUrl)).map(
      applySeLogerSearchMetadata
    );
    const scrapedAt = new Date().toISOString();

    return cards.map((card) =>
      mapSeLogerCardToListing(card, scrapedAt, place.name)
    );
  }
}
