import type { ListingRepository } from "../db/listingRepository.js";
import type { Scraper } from "../scrapers/types.js";
import type {
  ExtendedScrapeResult,
  Listing,
  ScrapeFilters,
} from "../types/listing.js";
import { resolveScraperGeoFilterLabel } from "../utils/geoFilter.js";

export type ScrapeOptions = ScrapeFilters;

export class ScraperService {
  constructor(
    private readonly scrapers: Scraper[],
    private readonly repository: ListingRepository
  ) {}

  async run(options: ScrapeOptions): Promise<ExtendedScrapeResult> {
    const allListings: Listing[] = [];

    for (const scraper of this.scrapers) {
      const zoneLabel = resolveScraperGeoFilterLabel(
        options,
        scraper.supportsTravelTime ?? false
      );
      console.log(
        `[scraper] ${scraper.name} — recherche à ${options.city} (${zoneLabel})...`
      );
      try {
        const listings = await scraper.scrape(options);
        console.log(
          `[scraper] ${scraper.name} — ${String(listings.length)} annonces trouvées`
        );
        allListings.push(...listings);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[scraper] ${scraper.name} — erreur: ${message}`);
      }
    }

    const { insertedListings, ...result } =
      await this.repository.upsertMany(allListings);
    return { ...result, insertedListings };
  }
}
