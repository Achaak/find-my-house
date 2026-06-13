import { describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { computePropertyKey } from "../utils/propertyKey.js";
import { reconcileProperties } from "./reconcileService.js";

describe("reconcile-properties grouping", () => {
  it("groups properties with the same dedup key", () => {
    const base = {
      postalCode: "75001",
      price: 420_000,
      surface: 110,
      rooms: 6,
      bedrooms: 4,
      landSurface: 900,
      propertyType: "house",
      isNewProperty: false,
    };

    const keyA = computePropertyKey(base);
    const keyB = computePropertyKey({
      ...base,
      price: 420_000,
      surface: 110.04,
    });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(computePropertyKey({ ...base, price: 425_000 }));
  });
});

describe("reconcileProperties", () => {
  it("merges duplicates when only the newer row has the computed property key", async () => {
    const { prisma, dispose } = createTestRepository();
    const dedupKey = computePropertyKey({
      postalCode: "76400",
      price: 300_000,
      surface: 152,
      rooms: 7,
      bedrooms: 5,
      landSurface: 1009,
      propertyType: "Maison",
      isNewProperty: false,
    });

    try {
      const older = await prisma.property.create({
        data: {
          propertyKey: "stale-key",
          title: "Older listing",
          price: 300_000,
          firstPrice: 300_000,
          surface: 152,
          landSurface: 1009,
          rooms: 7,
          bedrooms: 5,
          isNewProperty: false,
          city: "Sainte-Hélène-Bondeville",
          postalCode: "76400",
          propertyType: "Maison",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const newer = await prisma.property.create({
        data: {
          propertyKey: dedupKey,
          title: "Newer listing",
          price: 300_000,
          firstPrice: 295_000,
          surface: 152,
          landSurface: 1009,
          rooms: 7,
          bedrooms: 5,
          isNewProperty: false,
          city: "Sainte-Hélène-Bondeville",
          postalCode: "76400",
          propertyType: "Maison",
          firstSeenAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      await prisma.listingPublication.createMany({
        data: [
          {
            propertyId: older.id,
            externalId: "old-lbc",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/ventes_immobilieres/old-lbc",
            scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            propertyId: newer.id,
            externalId: "new-lbc",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/ventes_immobilieres/new-lbc",
            scrapedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ],
      });

      const result = await reconcileProperties(prisma);

      expect(result.merged).toBe(1);
      expect(result.fuzzyMerged).toBe(0);
      expect(result.unique).toBe(1);

      const properties = await prisma.property.findMany({
        include: { publications: true },
        orderBy: { id: "asc" },
      });

      expect(properties).toHaveLength(1);
      expect(properties[0]?.id).toBe(older.id);
      expect(properties[0]?.propertyKey).toBe(dedupKey);
      expect(properties[0]?.firstPrice).toBe(295_000);
      expect(properties[0]?.publications).toHaveLength(2);
    } finally {
      await dispose();
    }
  });
});
