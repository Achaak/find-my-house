import type { ListingRepository } from "../db/listingRepository.js";
import type { Scraper } from "../scrapers/types.js";
import type {
  Listing,
  PropertyRow,
  ScrapeFilters,
  ScrapeResult,
} from "../types/listing.js";
import { geoFilterLabel, resolveGeoFilter } from "../utils/geoFilter.js";

export type ScrapeOptions = ScrapeFilters;

export class ScraperService {
  constructor(
    private readonly scrapers: Scraper[],
    private readonly repository: ListingRepository
  ) {}

  async run(options: ScrapeOptions): Promise<
    ScrapeResult & {
      insertedListings: PropertyRow[];
      priceDropListings: PropertyRow[];
    }
  > {
    const allListings: Listing[] = [];

    for (const scraper of this.scrapers) {
      const geoFilter = resolveGeoFilter(
        options,
        scraper.supportsTravelTime ?? false
      );
      const zoneLabel = geoFilterLabel(geoFilter);
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
        console.error(`[scraper] ${scraper.name} — erreur:`, error);
      }
    }

    const { insertedListings, ...result } =
      await this.repository.upsertMany(allListings);
    return { ...result, insertedListings };
  }
}
