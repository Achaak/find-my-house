import { describe, expect, it } from "vitest";
import { buildScrapeFilters, scrapeConfig } from "./scrape.js";

describe("buildScrapeFilters", () => {
  it("maps scrapeConfig.scrape to ScrapeFilters", () => {
    expect(buildScrapeFilters()).toEqual({
      city: scrapeConfig.scrape.city,
      maxPrice: scrapeConfig.scrape.maxPrice,
      minSurface: scrapeConfig.scrape.minSurface,
      minLandSurface: scrapeConfig.scrape.minLandSurface,
      minRooms: scrapeConfig.scrape.minRooms,
      minBedrooms: scrapeConfig.scrape.minBedrooms,
      ancienOnly: scrapeConfig.scrape.ancienOnly,
      radiusKm: scrapeConfig.scrape.radiusKm,
      maxTravelMinutes: scrapeConfig.scrape.maxTravelMinutes,
    });
  });
});

describe("scrapeConfig.scrape.maxPages", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(scrapeConfig.scrape.maxPages)).toBe(true);
    expect(scrapeConfig.scrape.maxPages).toBeGreaterThan(0);
  });
});
