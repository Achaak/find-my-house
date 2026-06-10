import type { ListingRepository } from "../db/listingRepository.js";
import type { Scraper } from "../scrapers/types.js";
import type { Listing, ListingRow, ScrapeResult } from "../types/listing.js";

export interface ScrapeOptions {
  city: string;
  maxPrice: number;
  minSurface: number;
}

export class ScraperService {
  constructor(
    private readonly scrapers: Scraper[],
    private readonly repository: ListingRepository
  ) {}

  async run(
    options: ScrapeOptions
  ): Promise<ScrapeResult & { listings: Listing[]; insertedListings: ListingRow[] }> {
    const allListings: Listing[] = [];

    for (const scraper of this.scrapers) {
      console.log(`[scraper] ${scraper.name} — recherche à ${options.city}...`);
      try {
        const listings = await scraper.scrape(options);
        console.log(`[scraper] ${scraper.name} — ${listings.length} annonces trouvées`);
        allListings.push(...listings);
      } catch (error) {
        console.error(`[scraper] ${scraper.name} — erreur:`, error);
      }
    }

    const { insertedListings, ...result } =
      await this.repository.upsertMany(allListings);
    return { ...result, listings: allListings, insertedListings };
  }
}
