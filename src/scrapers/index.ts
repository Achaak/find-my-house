import { config } from "../config.js";
import { BienIciScraper } from "./bienici.js";
import { LeboncoinScraper } from "./leboncoin.js";
import { SeLogerScraper } from "./seloger.js";
import type { Scraper } from "./types.js";

const ALL_SCRAPERS = (): Scraper[] => [
  new BienIciScraper(),
  new LeboncoinScraper(),
  new SeLogerScraper(),
];

export function createScrapers(): Scraper[] {
  const allScrapers = ALL_SCRAPERS();
  const enabled = config.scrape.scrapers;

  if (!enabled) {
    return allScrapers;
  }

  const knownNames = new Set(allScrapers.map((s) => s.name));
  const unknown = enabled.filter((name) => !knownNames.has(name));
  if (unknown.length > 0) {
    console.warn(
      `[scraper] Noms inconnus dans SCRAPE_SCRAPERS (ignorés): ${unknown.join(", ")}`
    );
  }

  const enabledSet = new Set(enabled);
  const filtered = allScrapers.filter((s) => enabledSet.has(s.name));

  if (filtered.length === 0) {
    console.warn("[scraper] Aucun scraper activé — vérifiez SCRAPE_SCRAPERS");
  }

  return filtered;
}

export type { Scraper, ScraperOptions } from "./types.js";
