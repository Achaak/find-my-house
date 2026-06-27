import type { StatsSeriesRange } from "@find-my-house/api-types";
import type { ListingRepository } from "../db/listingRepository.js";
import type { StatsSeriesData } from "../types/statsSeries.js";

const RANGE_DAYS: Record<StatsSeriesRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const HISTOGRAM_CACHE_TTL_MS = 60_000;
let histogramCache: {
  expiresAt: number;
  data: StatsSeriesData["priceHistogram"];
} | null = null;

async function getCachedPriceHistogram(
  repository: ListingRepository
): Promise<StatsSeriesData["priceHistogram"]> {
  const now = Date.now();
  if (histogramCache && histogramCache.expiresAt > now) {
    return histogramCache.data;
  }
  const data = await repository.getPriceHistogram();
  histogramCache = { expiresAt: now + HISTOGRAM_CACHE_TTL_MS, data };
  return data;
}

export function clearStatsSeriesCache(): void {
  histogramCache = null;
}

export function parseStatsSeriesRange(
  value: string | undefined
): StatsSeriesRange {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

function rangeStart(range: StatsSeriesRange): Date {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - RANGE_DAYS[range] + 1);
  return since;
}

export async function fetchStatsSeries(
  repository: ListingRepository,
  range: StatsSeriesRange
): Promise<StatsSeriesData> {
  const since = rangeStart(range);

  const [
    snapshots,
    newProperties,
    scrapes,
    deactivations,
    reactions,
    priceHistogram,
  ] = await Promise.all([
    repository.getDailySnapshots(since),
    repository.getNewPropertiesByDay(since),
    repository.getScrapesByDay(since),
    repository.getDeactivationsByDay(since),
    repository.getReactionsByWeek(since),
    getCachedPriceHistogram(repository),
  ]);

  return {
    range,
    snapshots: snapshots.map((row) => ({
      date: row.date,
      activeProperties: row.activeProperties,
      activePublications: row.activePublications,
      medianPrice: row.medianPrice,
      priceDropCount: row.priceDropCount,
    })),
    newProperties,
    scrapes,
    deactivations,
    reactions,
    priceHistogram,
  };
}

export async function recordDailySnapshot(
  repository: ListingRepository
): Promise<void> {
  await repository.upsertDailySnapshot();
  clearStatsSeriesCache();
}

/** Ensure today has a snapshot row and bootstrap sparse history. */
export async function ensureTodaySnapshot(
  repository: ListingRepository
): Promise<void> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.toISOString().slice(0, 10);
  const rows = await repository.getDailySnapshots(startOfToday);
  if (!rows.some((row) => row.date === today)) {
    await recordDailySnapshot(repository);
  }

  const since = new Date(startOfToday);
  since.setDate(since.getDate() - 6);
  const week = await repository.getDailySnapshots(since);
  if (week.length < 7) {
    await repository.backfillDailySnapshots(90);
    clearStatsSeriesCache();
  }
}
