import { describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { Scraper } from "../scrapers/types.js";
import { ScraperService } from "./scraperService.js";

function mockScraper(
  name: Scraper["name"],
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
    const alpha = mockScraper("bienici", [
      makeListing({
        externalId: "alpha-1",
        url: "https://www.bienici.com/annonce/alpha-1",
      }),
    ]);
    const beta = mockScraper("leboncoin", [
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
      mockScraper("seloger", new Error("API down")),
      mockScraper("bienici", [
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
        { scraper: "seloger", message: "API down" },
      ]);
      expect(result.deactivated).toBe(0);
    } finally {
      await dispose();
    }
  });

  it("deactivates publications missing from a successful scraper run", async () => {
    const { repository, dispose } = createTestRepository();
    const existing = makeListing({
      externalId: "stale-lbc",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/stale-lbc",
    });
    await repository.upsertMany([existing]);

    const scrapers = [
      mockScraper("leboncoin", [
        makeListing({
          externalId: "fresh-lbc",
          source: "leboncoin",
          url: "https://www.leboncoin.fr/ad/fresh-lbc",
          price: 320_000,
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

      expect(result.deactivated).toBe(1);
      expect(await repository.countPublications()).toBe(1);
    } finally {
      await dispose();
    }
  });

  it("drops invalid listings before persistence", async () => {
    const { repository, dispose } = createTestRepository();
    const existing = makeListing({
      externalId: "existing-good",
      url: "https://www.bienici.com/annonce/existing-good",
    });
    await repository.upsertMany([existing]);

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
      expect(result.deactivated).toBe(0);
      expect(await repository.countPublications()).toBe(1);
    } finally {
      await dispose();
    }
  });

  it("skips deactivation when a scraper returns no listings", async () => {
    const { repository, dispose } = createTestRepository();
    const existing = makeListing({
      externalId: "keep-me",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/keep-me",
    });
    await repository.upsertMany([existing]);

    const scrapers = [mockScraper("leboncoin", [])];

    try {
      const service = new ScraperService(scrapers, repository);
      const result = await service.run({
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      });

      expect(result.deactivated).toBe(0);
      expect(await repository.countPublications()).toBe(1);
    } finally {
      await dispose();
    }
  });
});
