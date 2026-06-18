import { describe, expect, it, vi } from "vitest";
import { createClassifiedPortalScraper } from "./classifiedPortalScraper.js";
import type {
  ClassifiedCard,
  ClassifiedPlace,
} from "../utils/classifiedPortal/types.js";

const place: ClassifiedPlace = {
  name: "Lanquetot",
  center: { lat: 49.5833, lng: 0.45 },
  locationCode: "AD08FR76376",
};

vi.mock("../utils/bienici/place.js", () => ({
  resolveBienIciTravelOrigin: vi.fn(() =>
    Promise.resolve({
      address: "Lanquetot",
      center: { lat: 49.5833, lng: 0.45 },
    })
  ),
}));

describe("createClassifiedPortalScraper", () => {
  it("filters intermediate travel times using postal-code centroids", async () => {
    const nearby: ClassifiedCard = {
      id: "near",
      cardType: "classified",
      zipCode: "76400",
      cityLabel: "Fécamp",
    };
    const far: ClassifiedCard = {
      id: "far",
      cardType: "classified",
      zipCode: "14000",
      cityLabel: "Caen",
    };

    const scraper = createClassifiedPortalScraper("seloger", "SeLoger", {
      resolvePlace: () => Promise.resolve(place),
      buildLocation: () => Promise.resolve("travel-location"),
      buildSearchUrl: () => "https://example.test/search",
      fetchClassifieds: () => Promise.resolve([nearby, far]),
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
        city: card.cityLabel ?? "Lanquetot",
        postalCode: card.zipCode ?? null,
        url: `https://example.test/${String(card.id)}`,
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
      city: "Lanquetot",
      maxPrice: 500_000,
      minSurface: 30,
      maxTravelMinutes: 35,
    });

    expect(listings).toHaveLength(1);
    expect(listings[0]?.externalId).toBe("near");
  });
});
