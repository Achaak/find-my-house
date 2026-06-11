import { describe, expect, it } from "vitest";
import { buildScrapeFilters, config } from "./config.js";

describe("buildScrapeFilters", () => {
  it("maps config.scrape to ScrapeFilters", () => {
    expect(buildScrapeFilters()).toEqual({
      city: config.scrape.city,
      maxPrice: config.scrape.maxPrice,
      minSurface: config.scrape.minSurface,
      minLandSurface: config.scrape.minLandSurface,
      minRooms: config.scrape.minRooms,
      minBedrooms: config.scrape.minBedrooms,
      ancienOnly: config.scrape.ancienOnly,
      radiusKm: config.scrape.radiusKm,
      maxTravelMinutes: config.scrape.maxTravelMinutes,
    });
  });
});
