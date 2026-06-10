import type { Listing } from "../types/listing.js";
import type { BrowserManager } from "./browser.js";
import { slugifyCity, waitForJsonResponse } from "./playwright.js";
import type { Scraper, ScraperOptions } from "./types.js";

interface BienIciAd {
  id: string;
  title: string;
  price: number;
  surfaceArea?: number;
  roomsQuantity?: number;
  city: string;
  postalCode?: string;
  description?: string;
  photos?: Array<{ url_photo: string }>;
  propertyType?: string;
  url?: string;
}

interface BienIciResponse {
  realEstateAds: BienIciAd[];
  total: number;
}

const SEARCH_BASE = "https://www.bienici.com/recherche/achat";

export class BienIciScraper implements Scraper {
  readonly name = "bienici";

  constructor(private readonly browser: BrowserManager) {}

  async scrape(options: ScraperOptions): Promise<Listing[]> {
    const context = await this.browser.newContext();

    try {
      const page = await context.newPage();
      const slug = slugifyCity(options.city);
      const responsePromise = waitForJsonResponse<BienIciResponse>(
        page,
        "realEstateAds.json"
      );

      await page.goto(`${SEARCH_BASE}/${slug}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      const data = await responsePromise;
      const scrapedAt = new Date().toISOString();

      return data.realEstateAds
        .filter((ad) => ad.price <= options.maxPrice)
        .filter(
          (ad) =>
            ad.surfaceArea === undefined ||
            ad.surfaceArea >= options.minSurface
        )
        .map((ad) => this.mapAd(ad, scrapedAt));
    } finally {
      await context.close();
    }
  }

  private mapAd(ad: BienIciAd, scrapedAt: string): Listing {
    const url = ad.url ?? `https://www.bienici.com/annonce/${ad.id}`;

    return {
      externalId: ad.id,
      source: "bienici",
      title: ad.title,
      price: ad.price,
      surface: ad.surfaceArea ?? null,
      rooms: ad.roomsQuantity ?? null,
      city: ad.city,
      postalCode: ad.postalCode ?? null,
      url,
      description: ad.description ?? null,
      imageUrl: ad.photos?.[0]?.url_photo ?? null,
      propertyType: ad.propertyType ?? null,
      scrapedAt,
    };
  }
}
