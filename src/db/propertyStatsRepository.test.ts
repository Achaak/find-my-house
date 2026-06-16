import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "./listingRepository.js";
import { PropertyStatsRepository } from "./propertyStatsRepository.js";

describe("PropertyStatsRepository", () => {
  let repository: ListingRepository;
  let statsRepository: PropertyStatsRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    statsRepository = new PropertyStatsRepository(testDb.prisma);
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("counts properties and publications", async () => {
    await repository.upsertMany([
      makeListing({
        externalId: "stats-a",
        url: "https://www.bienici.com/annonce/stats-a",
        city: "Statstown",
        price: 250_000,
      }),
      makeListing({
        externalId: "stats-b",
        url: "https://www.bienici.com/annonce/stats-b",
        city: "Statstown",
        price: 350_000,
      }),
    ]);

    expect(await statsRepository.count()).toBe(2);
    expect(await statsRepository.countPublications()).toBe(2);
    expect(await statsRepository.countActiveProperties()).toBe(2);
  });

  it("computes price stats for active listings", async () => {
    const stats = await statsRepository.getPriceStats();
    expect(stats).not.toBeNull();
    expect(stats?.count).toBeGreaterThanOrEqual(2);
    expect(stats?.min).toBeLessThanOrEqual(stats?.max ?? 0);
    expect(stats?.median).toBeGreaterThan(0);
  });

  it("groups publication counts by source", async () => {
    const counts = await statsRepository.getPublicationCountsBySource();
    expect(counts.bienici.active).toBeGreaterThanOrEqual(2);
  });

  it("returns top cities", async () => {
    const cities = await statsRepository.getTopCities(3);
    expect(cities.some((entry) => entry.city === "Statstown")).toBe(true);
  });
});
