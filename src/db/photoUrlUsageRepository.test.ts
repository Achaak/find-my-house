import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import type { ListingRepository } from "./listingRepository.js";
import { photoUrlDedupKey } from "../utils/images/filterSyndicatedPhotoUrls.js";

describe("ListingRepository.findOverusedPhotoUrlKeys", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;
  let prisma: import("../generated/prisma/client.js").PrismaClient;

  beforeEach(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    prisma = testDb.prisma;
    dispose = testDb.dispose;
  });

  afterEach(async () => {
    await dispose?.();
  });

  it("returns URLs shared by at least the minimum property count", async () => {
    const spam = "https://media.immo-facile.com/syndicated.jpg?DATEMAJ=1";
    const scrapedAt = new Date("2026-01-15T10:00:00.000Z");

    for (let index = 0; index < 3; index++) {
      await prisma.property.create({
        data: {
          propertyKey: `spam-property-${String(index)}`,
          title: `Maison ${String(index)}`,
          price: 300_000 + index * 10_000,
          firstPrice: 300_000 + index * 10_000,
          city: `City-${String(index)}`,
          postalCode: `7500${String(index)}`,
          firstSeenAt: scrapedAt,
          publications: {
            create: {
              externalId: `spam-${String(index)}`,
              source: "bienici",
              url: `https://www.bienici.com/annonce/spam-${String(index)}`,
              title: `Maison ${String(index)}`,
              price: 300_000 + index * 10_000,
              city: `City-${String(index)}`,
              postalCode: `7500${String(index)}`,
              imageUrl: spam,
              imageUrls: [spam],
              scrapedAt,
            },
          },
        },
      });
    }

    const blocked = await repository.findOverusedPhotoUrlKeys(3);

    expect(blocked.has(photoUrlDedupKey(spam))).toBe(true);
    expect(
      blocked.has(photoUrlDedupKey("https://example.com/unique-0.jpg"))
    ).toBe(false);
  });
});
