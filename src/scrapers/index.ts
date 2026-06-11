import { BienIciScraper } from "./bienici.js";
import { LeboncoinScraper } from "./leboncoin.js";
import { SeLogerScraper } from "./seloger.js";
import type { Scraper } from "./types.js";

export function createScrapers(): Scraper[] {
  return [new BienIciScraper(), new LeboncoinScraper(), new SeLogerScraper()];
}

export type { Scraper, ScraperOptions } from "./types.js";
