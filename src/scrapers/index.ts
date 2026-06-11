import { BienIciScraper } from "./bienici.js";
import type { Scraper } from "./types.js";

export function createScrapers(): Scraper[] {
  return [new BienIciScraper()];
}

export type { Scraper, ScraperOptions } from "./types.js";
