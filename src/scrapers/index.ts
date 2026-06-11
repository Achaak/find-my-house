import { BienIciScraper } from "./bienici.js";
import { LeboncoinScraper } from "./leboncoin.js";
import type { Scraper } from "./types.js";

export function createScrapers(): Scraper[] {
  return [new BienIciScraper(), new LeboncoinScraper()];
}

export type { Scraper, ScraperOptions } from "./types.js";
