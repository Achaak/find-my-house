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

export type ScrapeOptions = ScrapeFilters;

const log = createLogger("scraper");

export class ScraperService {
  constructor(
    private readonly scrapers: Scraper[],
    private readonly repository: ListingRepository
  ) {}

  async run(options: ScrapeOptions): Promise<ExtendedScrapeResult> {
    const allListings: Listing[] = [];
    const scrapedBySource = new Map<ListingSource, Listing[]>();
    const errors: ScraperError[] = [];

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

    const { insertedListings, ...scrapeResult } =
      await this.repository.upsertMany(validListings);

    let deactivated = 0;
    for (const [source] of scrapedBySource) {
      const validForSource = validBySource.get(source) ?? [];
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

    return { ...scrapeResult, insertedListings, errors, deactivated };
  }
}
