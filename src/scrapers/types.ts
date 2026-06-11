import type { Listing, ScrapeFilters } from "../types/listing.js";

export type ScraperOptions = ScrapeFilters;

export interface Scraper {
  readonly name: string;
  /** false pour les scrapers qui ne filtrent qu'au rayon (km). */
  readonly supportsTravelTime?: boolean;
  scrape(options: ScraperOptions): Promise<Listing[]>;
}
