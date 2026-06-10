import { BienIciScraper } from "./bienici.js";
import type { BrowserManager } from "./browser.js";
import type { Scraper } from "./types.js";

export function createScrapers(browser: BrowserManager): Scraper[] {
  return [new BienIciScraper(browser)];
}

export { BrowserManager } from "./browser.js";
export type { Scraper, ScraperOptions } from "./types.js";
