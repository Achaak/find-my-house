import type { Listing, ScrapeFilters } from "../types/listing.js";

export type ScraperOptions = ScrapeFilters;

export type Scraper = {
  readonly name: string;
  /** false when the portal has no isochrone API (travel time → estimated radius). */
  readonly supportsTravelTime?: boolean;
  scrape(options: ScraperOptions): Promise<Listing[]>;
};
