import type { ListingRepository } from "../db/listingRepository.js";
import type { Scraper } from "../scrapers/types.js";
import type {
  ExtendedScrapeResult,
  Listing,
  ListingSource,
  ScrapeFilters,
  ScraperError,
} from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import { validateListings } from "../utils/listingValidation.js";
import { resolveScraperGeoFilterLabel } from "../utils/geo/geoFilter.js";
import { ensureBrowserReady } from "../utils/browser/client.js";

export type ScrapeOptions = ScrapeFilters;

const log = createLogger("scraper");

/** Serializes scrape runs so cron, Discord, and scripts do not overlap. */
let scrapeRunLock: Promise<void> = Promise.resolve();
let scrapeInProgress = false;

export function isScrapeInProgress(): boolean {
  return scrapeInProgress;
}

export class ScraperService {
  constructor(
    private readonly scrapers: Scraper[],
    private readonly repository: ListingRepository
  ) {}

  async run(options: ScrapeOptions): Promise<ExtendedScrapeResult> {
    let releaseLock!: () => void;
    const waitForLock = scrapeRunLock;
    scrapeRunLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });
    await waitForLock;

    scrapeInProgress = true;
    try {
      return await this.runUnlocked(options);
    } finally {
      scrapeInProgress = false;
      releaseLock();
    }
  }

  private async runUnlocked(
    options: ScrapeOptions
  ): Promise<ExtendedScrapeResult> {
    const allListings: Listing[] = [];
    const scrapedBySource = new Map<ListingSource, Listing[]>();
    const errors: ScraperError[] = [];

    await ensureBrowserReady();

    await Promise.all(
      this.scrapers.map(async (scraper) => {
        const zoneLabel = resolveScraperGeoFilterLabel(
          options,
          scraper.supportsTravelTime ?? false
        );
        log.info(
          `${scraper.name} — searching ${options.city} (${zoneLabel})...`
        );

        try {
          const listings = await scraper.scrape(options);
          log.info(
            `${scraper.name} — ${String(listings.length)} listings found`
          );
          scrapedBySource.set(scraper.name, listings);
          allListings.push(...listings);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          log.error(`${scraper.name} — error: ${message}`);
          errors.push({ scraper: scraper.name, message });
        }
      })
    );

    const validListings = validateListings(allListings);
    const validBySource = new Map<ListingSource, Listing[]>();
    for (const listing of validListings) {
      const forSource = validBySource.get(listing.source) ?? [];
      forSource.push(listing);
      validBySource.set(listing.source, forSource);
    }

    const { insertedListings, linkedListings, ...scrapeResult } =
      await this.repository.upsertMany(validListings);

    let deactivated = 0;
    for (const [source, rawForSource] of scrapedBySource) {
      const validForSource = validBySource.get(source) ?? [];

      if (validForSource.length === 0) {
        if (rawForSource.length > 0) {
          log.warn(
            `${source} — ${String(rawForSource.length)} listing(s) dropped by validation — skipping deactivation`
          );
        } else {
          log.warn(
            `${source} — no valid listings — skipping deactivation (empty result or possible block)`
          );
        }
        continue;
      }

      const count = await this.repository.deactivateMissingPublications(
        source,
        validForSource
      );
      if (count > 0) {
        log.info(
          `${source} — ${String(count)} publication(s) deactivated (missing from scrape)`
        );
      }
      deactivated += count;
    }

    return {
      ...scrapeResult,
      insertedListings,
      linkedListings,
      errors,
      deactivated,
    };
  }
}
