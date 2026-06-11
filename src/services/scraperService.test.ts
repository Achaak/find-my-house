import { describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { Scraper } from "../scrapers/types.js";
import { ScraperService } from "./scraperService.js";

function mockScraper(
  name: string,
  listings: ReturnType<typeof makeListing>[] | Error
): Scraper & { scrapeMock: ReturnType<typeof vi.fn> } {
  const scrapeMock = vi.fn(() => {
    if (listings instanceof Error) return Promise.reject(listings);
    return Promise.resolve(listings);
  });
  return {
    name,
    scrape: scrapeMock,
    scrapeMock,
  };
}

describe("ScraperService", () => {
  it("runs scrapers in parallel and aggregates listings", async () => {
    const { repository, dispose } = createTestRepository();
    const alpha = mockScraper("alpha", [
      makeListing({
        externalId: "alpha-1",
        url: "https://www.bienici.com/annonce/alpha-1",
      }),
    ]);
    const beta = mockScraper("beta", [
      makeListing({
        externalId: "beta-1",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/beta-1",
        postalCode: "75002",
        price: 310_000,
      }),
    ]);
    const scrapers = [alpha, beta];

    try {
      const service = new ScraperService(scrapers, repository);
      const result = await service.run({
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      });

      expect(alpha.scrapeMock).toHaveBeenCalledOnce();
      expect(beta.scrapeMock).toHaveBeenCalledOnce();
      expect(result.found).toBe(2);
      expect(result.inserted).toBe(2);
      expect(result.errors).toEqual([]);
    } finally {
      await dispose();
    }
  });

  it("continues when one scraper fails", async () => {
    const { repository, dispose } = createTestRepository();
    const scrapers = [
      mockScraper("broken", new Error("API down")),
      mockScraper("ok", [
        makeListing({
          externalId: "ok-1",
          url: "https://www.bienici.com/annonce/ok-1",
        }),
      ]),
    ];

    try {
      const service = new ScraperService(scrapers, repository);
      const result = await service.run({
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      });

      expect(result.found).toBe(1);
      expect(result.inserted).toBe(1);
      expect(result.errors).toEqual([
        { scraper: "broken", message: "API down" },
      ]);
    } finally {
      await dispose();
    }
  });

  it("drops invalid listings before persistence", async () => {
    const { repository, dispose } = createTestRepository();
    const invalid = makeListing({
      externalId: "bad-price",
      url: "https://www.bienici.com/annonce/bad-price",
      price: -1,
    });
    const scrapers = [mockScraper("bienici", [invalid])];

    try {
      const service = new ScraperService(scrapers, repository);
      const result = await service.run({
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      });

      expect(result.found).toBe(0);
      expect(result.inserted).toBe(0);
    } finally {
      await dispose();
    }
  });
});
