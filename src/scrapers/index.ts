import { scrapeConfig } from "../config/scrape.js";
import { createLogger } from "../utils/logger.js";
import { BienIciScraper } from "./bienici.js";
import { LeboncoinScraper } from "./leboncoin.js";
import { LogicImmoScraper } from "./logicimmo.js";
import { SeLogerScraper } from "./seloger.js";
import type { Scraper } from "./types.js";

const log = createLogger("scraper");

const ALL_SCRAPERS = (): Scraper[] => [
  new BienIciScraper(),
  new LeboncoinScraper(),
  new SeLogerScraper(),
  new LogicImmoScraper(),
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
      `Noms inconnus dans SCRAPE_SCRAPERS (ignorés): ${unknown.join(", ")}`
    );
  }

  const enabledSet = new Set(enabled);
  const filtered = allScrapers.filter((s) => enabledSet.has(s.name));

  if (filtered.length === 0) {
    log.warn("Aucun scraper activé — vérifiez SCRAPE_SCRAPERS");
  }

  return filtered;
}

export type { Scraper, ScraperOptions } from "./types.js";
