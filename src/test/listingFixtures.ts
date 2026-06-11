import type { Listing } from "../types/listing.js";

export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    externalId: "ext-1",
    source: "bienici",
    title: "Maison de test",
    price: 300_000,
    surface: 90,
    landSurface: 500,
    rooms: 5,
    bedrooms: 3,
    isNewProperty: false,
    latitude: 48.8566,
    longitude: 2.3522,
    city: "Paris",
    postalCode: "75001",
    url: "https://www.bienici.com/annonce/ext-1",
    description: null,
    imageUrl: null,
    propertyType: "house",
    dpeClass: "C",
    gesClass: "D",
    dpeConsumptionKwhM2: null,
    gesEmissionKgM2: null,
    scrapedAt: "2026-01-15T10:00:00.000Z",
    ...overrides,
  };
}
