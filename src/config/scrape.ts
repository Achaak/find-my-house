import type { ScrapeFilters } from "../types/listing.js";
import "./env.js";
import { parseScrapeConfig } from "./schema.js";

export const scrapeConfig = parseScrapeConfig();

export function buildScrapeFilters(): ScrapeFilters {
  return {
    city: scrapeConfig.scrape.city,
    maxPrice: scrapeConfig.scrape.maxPrice,
    minSurface: scrapeConfig.scrape.minSurface,
    minLandSurface: scrapeConfig.scrape.minLandSurface,
    minRooms: scrapeConfig.scrape.minRooms,
    minBedrooms: scrapeConfig.scrape.minBedrooms,
    ancienOnly: scrapeConfig.scrape.ancienOnly,
    radiusKm: scrapeConfig.scrape.radiusKm,
    maxTravelMinutes: scrapeConfig.scrape.maxTravelMinutes,
  };
}
