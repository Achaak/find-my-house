import type { Listing, ScrapeFilters } from "../types/listing.js";

export type ScraperOptions = ScrapeFilters;

export type Scraper = {
  readonly name: string;
  /** false for scrapers that only filter by radius (km). */
  readonly supportsTravelTime?: boolean;
  scrape(options: ScraperOptions): Promise<Listing[]>;
};
