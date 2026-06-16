import { scrapeConfig } from "../config/scrape.js";
import { createLogger } from "../utils/logger.js";
import { BienIciScraper } from "./bienici.js";
import { LeboncoinScraper } from "./leboncoin.js";
import { logicImmoScraper } from "./logicimmo.js";
import { seLogerScraper } from "./seloger.js";
import type { Scraper } from "./types.js";

const log = createLogger("scraper");

const ALL_SCRAPERS = (): Scraper[] => [
  new BienIciScraper(),
  new LeboncoinScraper(),
  seLogerScraper,
  logicImmoScraper,
];

export function createScrapers(): Scraper[] {
  const allScrapers = ALL_SCRAPERS();
  const enabled = scrapeConfig.scrape.scrapers;

  if (!enabled) {
    return allScrapers;
  }

  const knownNames = new Set(allScrapers.map((s) => s.name));
  const unknown = enabled.filter(
    (name) => !knownNames.has(name as (typeof allScrapers)[number]["name"])
  );
  if (unknown.length > 0) {
    log.warn(
      `Unknown names in SCRAPE_SCRAPERS (ignored): ${unknown.join(", ")}`
    );
  }

  const enabledSet = new Set(enabled);
  const filtered = allScrapers.filter((s) => enabledSet.has(s.name));

  if (filtered.length === 0) {
    log.warn("No scrapers enabled — check SCRAPE_SCRAPERS");
  }

  return filtered;
}

export type { Scraper, ScraperOptions } from "./types.js";
