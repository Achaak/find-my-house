import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { findCachedListing } from "./listing-cache";
import { queryKeys } from "./api";
import type { BrowseState, Property } from "./types";

function makeProperty(id: number): Property {
  return {
    id,
    title: `Property ${String(id)}`,
    price: 100_000,
    firstPrice: 100_000,
    surface: 90,
    landSurface: null,
    rooms: 4,
    bedrooms: 2,
    isNewProperty: false,
    latitude: null,
    longitude: null,
    city: "Paris",
    postalCode: "75001",
    address: null,
    dpeNumero: null,
    description: null,
    imageUrl: null,
    propertyType: "house",
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
    firstSeenAt: "2026-01-01T00:00:00.000Z",
    publications: [],
    url: "https://example.com",
    source: "bienici",
    scrapedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    reaction: null,
    archived: false,
  };
}

describe("findCachedListing", () => {
  it("returns a property from listings query cache", () => {
    const queryClient = new QueryClient();
    const property = makeProperty(42);
    queryClient.setQueryData(["listings", { city: "Paris" }], {
      items: [property],
      total: 1,
    });

    expect(findCachedListing(queryClient, 42)).toEqual(property);
  });

  it("returns a property from the active browse session", () => {
    const queryClient = new QueryClient();
    const property = makeProperty(7);
    const browseState: BrowseState = {
      item: property,
      shownCount: 1,
      isExplore: false,
      hasPreferences: false,
      finished: false,
      criteria: { city: "Paris" },
    };
    queryClient.setQueryData(queryKeys.browse, browseState);

    expect(findCachedListing(queryClient, 7)).toEqual(property);
  });

  it("returns undefined when the property is not cached", () => {
    const queryClient = new QueryClient();
    expect(findCachedListing(queryClient, 999)).toBeUndefined();
  });
});
