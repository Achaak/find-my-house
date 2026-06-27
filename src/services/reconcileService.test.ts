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
            title: "Older publication",
            price: 300_000,
            city: "Sainte-Hélène-Bondeville",
            propertyType: "Maison",
            scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            propertyId: newer.id,
            externalId: "new-lbc",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/ventes_immobilieres/new-lbc",
            title: "Newer publication",
            price: 300_000,
            city: "Sainte-Hélène-Bondeville",
            propertyType: "Maison",
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

  it("fuzzy-merges properties when one row has incomplete portal fields", async () => {
    const { prisma, dispose } = createTestRepository();

    try {
      const older = await prisma.property.create({
        data: {
          propertyKey: "older-key",
          title: "Leboncoin listing",
          price: 239_000,
          firstPrice: 239_000,
          surface: 124,
          landSurface: 1500,
          rooms: 7,
          bedrooms: 6,
          isNewProperty: false,
          city: "Saint Martin de l'If",
          postalCode: "76190",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const newer = await prisma.property.create({
        data: {
          propertyKey: "newer-key",
          title: "Logic-Immo listing",
          price: 239_000,
          firstPrice: 239_000,
          surface: 124,
          landSurface: 1500,
          rooms: null,
          bedrooms: null,
          isNewProperty: null,
          city: "Saint Martin de l'If",
          postalCode: "76190",
          firstSeenAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      await prisma.listingPublication.createMany({
        data: [
          {
            propertyId: older.id,
            externalId: "lbc-sm",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/ventes_immobilieres/lbc-sm",
            title: "Leboncoin publication",
            price: 239_000,
            surface: 124,
            landSurface: 1500,
            rooms: 7,
            bedrooms: 6,
            isNewProperty: false,
            city: "Saint Martin de l'If",
            postalCode: "76190",
            propertyType: "Maison",
            scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            propertyId: newer.id,
            externalId: "limmo-sm",
            source: "logicimmo",
            url: "https://www.logic-immo.com/annonces/achat/maison/limmo-sm.htm",
            title: "Logic-Immo publication",
            price: 239_000,
            surface: 124,
            landSurface: 1500,
            rooms: null,
            bedrooms: null,
            isNewProperty: null,
            city: "Saint Martin de l'If",
            postalCode: "76190",
            propertyType: null,
            scrapedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ],
      });

      const result = await reconcileProperties(prisma);

      expect(result.fuzzyMerged).toBe(1);
      expect(result.unique).toBe(1);

      const properties = await prisma.property.findMany({
        include: { publications: true },
      });

      expect(properties).toHaveLength(1);
      expect(properties[0]?.publications).toHaveLength(2);
    } finally {
      await dispose();
    }
  });

  it("fuzzy-merges cross-portal duplicates blocked by isNewProperty conflicts", async () => {
    const { prisma, dispose } = createTestRepository();

    try {
      const leboncoinOnly = await prisma.property.create({
        data: {
          propertyKey: "merge-lbc-only",
          title: "Leboncoin only",
          price: 197_000,
          firstPrice: 197_000,
          surface: 130,
          landSurface: 1000,
          rooms: 5,
          bedrooms: 3,
          isNewProperty: false,
          city: "Yvetot",
          postalCode: "76450",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const selogerLogicimmo = await prisma.property.create({
        data: {
          propertyKey: "merge-seloger-logicimmo",
          title: "SeLoger + Logic-Immo",
          price: 197_000,
          firstPrice: 197_000,
          surface: 130,
          landSurface: 1000,
          rooms: 5,
          bedrooms: 3,
          isNewProperty: true,
          city: "Yvetot",
          postalCode: "76450",
          firstSeenAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      await prisma.listingPublication.createMany({
        data: [
          {
            propertyId: leboncoinOnly.id,
            externalId: "lbc-475",
            source: "leboncoin",
            url: "https://www.leboncoin.fr/ad/ventes_immobilieres/lbc-475",
            title: "Leboncoin",
            price: 197_000,
            surface: 130,
            landSurface: 1000,
            rooms: 5,
            bedrooms: 3,
            isNewProperty: false,
            city: "Yvetot",
            postalCode: "76450",
            propertyType: "Maison",
            scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            propertyId: selogerLogicimmo.id,
            externalId: "seloger-780",
            source: "seloger",
            url: "https://www.seloger.com/annonces/achat/maison/780.htm",
            title: "SeLoger",
            price: 197_000,
            surface: 130,
            landSurface: 1000,
            rooms: 5,
            bedrooms: 3,
            isNewProperty: true,
            city: "Yvetot",
            postalCode: "76450",
            propertyType: "Maison",
            scrapedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ],
      });

      const result = await reconcileProperties(prisma);

      expect(result.fuzzyMerged).toBe(1);
      expect(await prisma.property.count()).toBe(1);
    } finally {
      await dispose();
    }
  });

  it("fuzzy-merges cross-portal duplicates with small surface differences", async () => {
    const { prisma, dispose } = createTestRepository();

    try {
      const older = await prisma.property.create({
        data: {
          propertyKey: "merge-older-112",
          title: "Older cluster",
          price: 197_000,
          firstPrice: 197_000,
          surface: 123,
          landSurface: 1476,
          rooms: 6,
          bedrooms: 4,
          isNewProperty: false,
          city: "Durdent",
          postalCode: "76560",
          firstSeenAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      });
      const newer = await prisma.property.create({
        data: {
          propertyKey: "merge-newer-301",
          title: "Newer cluster",
          price: 197_000,
          firstPrice: 197_000,
          surface: 122,
          landSurface: 1476,
          rooms: 6,
          bedrooms: 4,
          isNewProperty: false,
          city: "Durdent",
          postalCode: "76560",
          firstSeenAt: new Date("2026-02-01T00:00:00.000Z"),
        },
      });

      await prisma.listingPublication.createMany({
        data: [
          {
            propertyId: older.id,
            externalId: "seloger-112",
            source: "seloger",
            url: "https://www.seloger.com/annonces/achat/maison/112.htm",
            title: "SeLoger 112",
            price: 197_000,
            surface: 123,
            landSurface: 1476,
            rooms: 6,
            bedrooms: 4,
            isNewProperty: false,
            city: "Durdent",
            postalCode: "76560",
            propertyType: "Maison",
            scrapedAt: new Date("2026-01-01T00:00:00.000Z"),
          },
          {
            propertyId: newer.id,
            externalId: "seloger-301",
            source: "seloger",
            url: "https://www.seloger.com/annonces/achat/maison/301.htm",
            title: "SeLoger 301",
            price: 197_000,
            surface: 122,
            landSurface: 1476,
            rooms: 6,
            bedrooms: 4,
            isNewProperty: false,
            city: "Durdent",
            postalCode: "76560",
            propertyType: "Maison",
            scrapedAt: new Date("2026-02-01T00:00:00.000Z"),
          },
        ],
      });

      const result = await reconcileProperties(prisma);

      expect(result.fuzzyMerged).toBe(1);
      expect(await prisma.property.count()).toBe(1);
    } finally {
      await dispose();
    }
  });
});
