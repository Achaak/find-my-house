import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import {
  clearStatsSeriesCache,
  fetchStatsSeries,
  parseStatsSeriesRange,
} from "./statsSeriesService.js";

describe("statsSeriesService", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;

    await repository.upsertMany([
      makeListing({
        externalId: "series-a",
        url: "https://www.bienici.com/annonce/series-a",
        price: 200_000,
      }),
    ]);
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("parses valid ranges and defaults to 30d", () => {
    expect(parseStatsSeriesRange("7d")).toBe("7d");
    expect(parseStatsSeriesRange("90d")).toBe("90d");
    expect(parseStatsSeriesRange(undefined)).toBe("30d");
    expect(parseStatsSeriesRange("invalid")).toBe("30d");
  });

  it("returns series data for a range", async () => {
    const data = await fetchStatsSeries(repository, "7d");
    expect(data.range).toBe("7d");
    expect(Array.isArray(data.snapshots)).toBe(true);
    expect(Array.isArray(data.priceHistogram)).toBe(true);
    expect(Array.isArray(data.reactions)).toBe(true);
  });

  it("caches the price histogram for repeated calls", async () => {
    clearStatsSeriesCache();
    const spy = vi.spyOn(repository, "getPriceHistogram");

    await fetchStatsSeries(repository, "7d");
    await fetchStatsSeries(repository, "30d");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
