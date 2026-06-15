import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { fetchStatsSection } from "./statsService.js";

describe("fetchStatsSection", () => {
  let repository: ListingRepository;
  let reactionRepository: ReactionRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    reactionRepository = testDb.reactionRepository;
    dispose = testDb.dispose;

    await repository.upsertMany([
      makeListing({
        externalId: "stats-service",
        url: "https://www.bienici.com/annonce/stats-service",
        city: "Lyon",
      }),
    ]);
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("returns overview stats from repositories", async () => {
    const overview = await fetchStatsSection("overview", {
      repository,
      reactionRepository,
      enrichmentQueue: { getQueuedCount: () => 0 },
      scrapeDefaults: { city: "Lyon", maxPrice: 500_000, minSurface: 50 },
    });

    expect(overview.total).toBeGreaterThan(0);
    expect(overview.enrichment.queued).toBe(0);
    expect(overview.recent.length).toBeGreaterThan(0);
  });

  it("returns mine stats with reaction counts", async () => {
    const { items } = await repository.search({ limit: 1 });
    await reactionRepository.add(items[0].id, "like");

    const mine = await fetchStatsSection("mine", {
      repository,
      reactionRepository,
      enrichmentQueue: { getQueuedCount: () => 0 },
      scrapeDefaults: { city: "Lyon", maxPrice: 500_000, minSurface: 50 },
    });

    expect(mine.likes).toBeGreaterThan(0);
    expect(mine.recentLikes.length).toBeGreaterThan(0);
  });
});
