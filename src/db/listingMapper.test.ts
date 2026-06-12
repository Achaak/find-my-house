import { describe, expect, it } from "vitest";
import { InvariantError } from "../utils/errors/invariantError.js";
import { toPropertyRow } from "./listingMapper.js";

function makePrismaProperty(
  overrides: Partial<{
    id: number;
    publications: {
      id: number;
      externalId: string;
      source: "bienici" | "leboncoin" | "seloger";
      url: string;
      isActive?: boolean;
      scrapedAt: Date;
    }[];
  }> = {}
) {
  const scrapedAt = new Date("2026-01-15T10:00:00.000Z");
  const publications = overrides.publications ?? [
    {
      id: 1,
      externalId: "ext-1",
      source: "bienici" as const,
      url: "https://www.bienici.com/annonce/ext-1",
      isActive: true,
      scrapedAt,
    },
  ];

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
    address: null,
    dpeNumero: null,
    description: null,
    imageUrl: null,
    propertyType: "house",
    dpeClass: null,
    gesClass: null,
    dpeConsumptionKwhM2: null,
    gesEmissionKgM2: null,
    firstSeenAt: scrapedAt,
    createdAt: scrapedAt,
    updatedAt: scrapedAt,
    publications,
  };
}

describe("toPropertyRow", () => {
  it("maps the earliest publication as the primary listing", () => {
    const row = toPropertyRow(
      makePrismaProperty({
        publications: [
          {
            id: 2,
            externalId: "newer",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/newer",
            isActive: true,
            scrapedAt: new Date("2026-02-01T10:00:00.000Z"),
          },
          {
            id: 1,
            externalId: "older",
            source: "bienici",
            url: "https://www.bienici.com/annonce/older",
            isActive: true,
            scrapedAt: new Date("2026-01-01T10:00:00.000Z"),
          },
        ],
      })
    );

    expect(row.source).toBe("bienici");
    expect(row.url).toBe("https://www.bienici.com/annonce/older");
    expect(row.publications).toHaveLength(2);
  });

  it("throws when a property has no publications", () => {
    expect(() =>
      toPropertyRow(makePrismaProperty({ publications: [] }))
    ).toThrow(InvariantError);
  });
});
