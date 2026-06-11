import type { ListingRepository } from "../db/listingRepository.js";
import type { Scraper } from "../scrapers/types.js";
import type {
  ExtendedScrapeResult,
  Listing,
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
    const errors: ScraperError[] = [];

    await Promise.all(
      this.scrapers.map(async (scraper) => {
        const zoneLabel = resolveScraperGeoFilterLabel(
          options,
          scraper.supportsTravelTime ?? false
        );
        log.info(
          `${scraper.name} — recherche à ${options.city} (${zoneLabel})...`
        );

        try {
          const listings = await scraper.scrape(options);
          log.info(
            `${scraper.name} — ${String(listings.length)} annonces trouvées`
          );
          allListings.push(...listings);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          log.error(`${scraper.name} — erreur: ${message}`);
          errors.push({ scraper: scraper.name, message });
        }
      })
    );

    const validListings = validateListings(allListings);
    const { insertedListings, ...scrapeResult } =
      await this.repository.upsertMany(validListings);
    return { ...scrapeResult, insertedListings, errors };
  }
}
