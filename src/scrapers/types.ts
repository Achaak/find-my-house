import type { Listing } from "../types/listing.js";

export interface ScraperOptions {
  city: string;
  maxPrice: number;
  minSurface: number;
}

export interface Scraper {
  readonly name: string;
  scrape(options: ScraperOptions): Promise<Listing[]>;
}
