import { scrapeConfig } from "../config/scrape.js";
import type { Listing, ListingSource } from "../types/listing.js";
import { resolveGeoFilter } from "../utils/geo/geoFilter.js";
import type {
  ClassifiedCard,
  ClassifiedPlace,
} from "../utils/classifiedPortal/types.js";
import type { Scraper, ScraperOptions } from "./types.js";

export type ClassifiedPortalScraperDeps = {
  resolvePlace: (
    city: string,
    postalCode?: string
  ) => Promise<ClassifiedPlace | null>;
  buildLocation: (
    city: string,
    place: ClassifiedPlace,
    geoFilter: ReturnType<typeof resolveGeoFilter>,
    postalCode?: string
  ) => Promise<string>;
  buildSearchUrl: (options: ScraperOptions, location: string) => string;
  fetchClassifieds: (
    searchUrl: string,
    maxPages: number,
    place: ClassifiedPlace,
    postalCode?: string
  ) => Promise<ClassifiedCard[]>;
  applySearchMetadata: (card: ClassifiedCard) => ClassifiedCard;
  mapCardToListing: (
    card: ClassifiedCard,
    scrapedAt: string,
    fallbackCity: string
  ) => Listing;
};

export function createClassifiedPortalScraper(
  name: ListingSource,
  portalLabel: string,
  deps: ClassifiedPortalScraperDeps
): Scraper {
  return {
    name,
    supportsTravelTime: true,
    async scrape(options: ScraperOptions): Promise<Listing[]> {
      const place = await deps.resolvePlace(options.city, options.postalCode);
      if (!place) {
        throw new Error(
          `Unable to geolocate "${options.city}" on ${portalLabel}`
        );
      }

      const geoFilter = resolveGeoFilter(options, true);
      const location = await deps.buildLocation(
        options.city,
        place,
        geoFilter,
        options.postalCode
      );
      const searchUrl = deps.buildSearchUrl(options, location);
      const cards = (
        await deps.fetchClassifieds(
          searchUrl,
          scrapeConfig.scrape.maxPages,
          place,
          options.postalCode
        )
      ).map(deps.applySearchMetadata);
      const scrapedAt = new Date().toISOString();

      return cards.map((card) =>
        deps.mapCardToListing(card, scrapedAt, place.name)
      );
    },
  };
}
