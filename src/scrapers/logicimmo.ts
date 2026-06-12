import { scrapeConfig } from "../config/scrape.js";
import type { Listing } from "../types/listing.js";
import { resolveGeoFilter } from "../utils/geo/geoFilter.js";
import {
  applyLogicImmoSearchMetadata,
  buildLogicImmoLocation,
  buildLogicImmoSearchUrl,
  fetchLogicImmoClassifieds,
  mapLogicImmoCardToListing,
  resolveLogicImmoPlace,
} from "../utils/logicimmo/index.js";
import type { Scraper, ScraperOptions } from "./types.js";

export class LogicImmoScraper implements Scraper {
  readonly name = "logicimmo";
  readonly supportsTravelTime = true;

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const place = await resolveLogicImmoPlace(options.city);
    if (!place) {
      throw new Error(
        `Impossible de géolocaliser "${options.city}" sur Logic-Immo`
      );
    }

    const geoFilter = resolveGeoFilter(options, true);
    const location = await buildLogicImmoLocation(
      options.city,
      place,
      geoFilter
    );
    const searchUrl = buildLogicImmoSearchUrl(options, location);
    const cards = (
      await fetchLogicImmoClassifieds(searchUrl, scrapeConfig.scrape.maxPages)
    ).map(applyLogicImmoSearchMetadata);
    const scrapedAt = new Date().toISOString();

    return cards.map((card) =>
      mapLogicImmoCardToListing(card, scrapedAt, place.name)
    );
  }
}
