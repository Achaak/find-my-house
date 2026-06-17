import { describe, expect, it, vi } from "vitest";
import { createClassifiedPortalScraper } from "./classifiedPortalScraper.js";
import type {
  ClassifiedCard,
  ClassifiedPlace,
} from "../utils/classifiedPortal/types.js";

const place: ClassifiedPlace = {
  name: "Paris",
  center: { lat: 48.8566, lng: 2.3522 },
  locationCode: "AD08FR75056",
};

vi.mock("../utils/bienici/place.js", () => ({
  resolveBienIciTravelOrigin: vi.fn(async () => ({
    address: "Paris",
    center: { lat: 48.8566, lng: 2.3522 },
  })),
}));

describe("createClassifiedPortalScraper", () => {
  it("post-filters listings to the exact max travel minutes", async () => {
    const nearby: ClassifiedCard = {
      id: "near",
      cardType: "classified",
      latitude: 48.86,
      longitude: 2.36,
    };
    const far: ClassifiedCard = {
      id: "far",
      cardType: "classified",
      latitude: 49.5,
      longitude: 3.0,
    };

    const scraper = createClassifiedPortalScraper("seloger", "SeLoger", {
      resolvePlace: async () => place,
      buildLocation: async () => "travel-location",
      buildSearchUrl: () => "https://example.test/search",
      fetchClassifieds: async () => [nearby, far],
      applySearchMetadata: (card) => card,
      mapCardToListing: (card, scrapedAt) => ({
        externalId: card.id,
        source: "seloger",
        title: card.id,
        price: 100_000,
        surface: null,
        landSurface: null,
        rooms: null,
        bedrooms: null,
        isNewProperty: null,
        latitude: card.latitude ?? null,
        longitude: card.longitude ?? null,
        city: "Paris",
        postalCode: null,
        url: `https://example.test/${card.id}`,
        description: null,
        imageUrl: null,
        propertyType: null,
        dpeClass: null,
        gesClass: null,
        dpeConsumptionKwhM2: null,
        gesEmissionKgM2: null,
        bathrooms: null,
        constructionYear: null,
        heating: null,
        orientation: null,
        propertyCondition: null,
        parkingSpaces: null,
        highlights: null,
        scrapedAt,
      }),
    });

    const listings = await scraper.scrape({
      city: "Paris",
      maxPrice: 500_000,
      minSurface: 30,
      maxTravelMinutes: 40,
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]?.externalId).toBe("near");
  });
});
