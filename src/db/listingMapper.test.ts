import { describe, expect, it } from "vitest";
import { InvariantError } from "../utils/errors/invariantError.js";
import { toPropertyRow } from "./listingMapper.js";

function makePublication(
  overrides: Partial<{
    id: number;
    externalId: string;
    source: "bienici" | "leboncoin" | "seloger";
    url: string;
    isActive: boolean;
    scrapedAt: Date;
    propertyType: string | null;
    address: string | null;
  }> = {}
) {
  const scrapedAt = overrides.scrapedAt ?? new Date("2026-01-15T10:00:00.000Z");
  return {
    id: overrides.id ?? 1,
    externalId: overrides.externalId ?? "ext-1",
    source: overrides.source ?? ("bienici" as const),
    url: overrides.url ?? "https://www.bienici.com/annonce/ext-1",
    title: "Maison",
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
    address: overrides.address ?? null,
    dpeNumero: null,
    description: null,
    imageUrl: null,
    imageUrls: null,
    imageLocalHashes: null,
    enrichedAt: null,
    propertyType: overrides.propertyType ?? "house",
    dpeClass: null,
    gesClass: null,
    dpeConsumptionKwhM2: null,
    gesEmissionKgM2: null,
    bathrooms: 2,
    constructionYear: null,
    heating: null,
    orientation: null,
    propertyCondition: null,
    parkingSpaces: null,
    highlights: ["Garage"],
    isActive: overrides.isActive ?? true,
    scrapedAt,
  };
}

function makePrismaProperty(
  overrides: Partial<{
    id: number;
    publications: ReturnType<typeof makePublication>[];
  }> = {}
) {
  const scrapedAt = new Date("2026-01-15T10:00:00.000Z");
  const publications = overrides.publications ?? [makePublication()];

  return {
    id: overrides.id ?? 1,
    propertyKey: "key",
    title: "Maison",
    price: 300_000,
    firstPrice: 300_000,
    surface: 90,
    landSurface: 500,
    rooms: 5,
    bedrooms: 3,
    isNewProperty: false,
    latitude: 48.8566,
    longitude: 2.3522,
    city: "Paris",
    postalCode: "75001",
    dpeClass: null,
    gesClass: null,
    addressEnrichedAt: null,
    firstSeenAt: scrapedAt,
    createdAt: scrapedAt,
    updatedAt: scrapedAt,
    publications,
  };
}

describe("toPropertyRow", () => {
  it("returns only active publications", () => {
    const row = toPropertyRow(
      makePrismaProperty({
        publications: [
          makePublication({
            id: 2,
            externalId: "inactive",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/inactive",
            isActive: false,
            scrapedAt: new Date("2026-02-01T10:00:00.000Z"),
          }),
          makePublication({
            id: 1,
            externalId: "active",
            source: "bienici",
            url: "https://www.bienici.com/annonce/active",
            isActive: true,
            scrapedAt: new Date("2026-01-01T10:00:00.000Z"),
          }),
        ],
      })
    );

    expect(row.publications).toHaveLength(1);
    expect(row.publications[0]?.source).toBe("bienici");
  });

  it("returns an empty publications array when all are inactive", () => {
    const row = toPropertyRow(
      makePrismaProperty({
        publications: [
          makePublication({
            id: 1,
            externalId: "inactive",
            source: "bienici",
            url: "https://www.bienici.com/annonce/inactive",
            isActive: false,
            scrapedAt: new Date("2026-01-01T10:00:00.000Z"),
            propertyType: "apartment",
            address: "12 rue Example",
          }),
        ],
      })
    );

    expect(row.publications).toEqual([]);
    expect(row.propertyType).toBe("apartment");
    expect(row.address).toBe("12 rue Example");
    expect(row.bathrooms).toBe(2);
    expect(row.highlights).toEqual(["Garage"]);
  });

  it("throws when a property has no publications", () => {
    expect(() =>
      toPropertyRow(makePrismaProperty({ publications: [] }))
    ).toThrow(InvariantError);
  });
});
