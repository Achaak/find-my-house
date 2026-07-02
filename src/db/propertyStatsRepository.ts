import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import { displayEnrichmentBackfillWhere } from "../domain/enrichmentCriteria.js";
import { propertyInclude } from "./propertyInclude.js";
import { tryToPropertyRow } from "./listingMapper.js";

export class PropertyStatsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async count(): Promise<number> {
    return this.prisma.property.count();
  }

  async countPublications(): Promise<number> {
    return this.prisma.listingPublication.count({
      where: { isActive: true },
    });
  }

  async countActiveProperties(): Promise<number> {
    return this.prisma.property.count({
      where: { publications: { some: { isActive: true } } },
    });
  }

  async countPendingDisplayEnrichment(): Promise<number> {
    return this.prisma.property.count({
      where: displayEnrichmentBackfillWhere(),
    });
  }

  async countInactivePublications(): Promise<number> {
    return this.prisma.listingPublication.count({
      where: { isActive: false },
    });
  }

  async getPublicationCountsBySource(): Promise<SourcePublicationCounts> {
    const rows = await this.prisma.listingPublication.groupBy({
      by: ["source", "isActive"],
      _count: { _all: true },
    });

    const counts: SourcePublicationCounts = {
      bienici: { active: 0, inactive: 0 },
      seloger: { active: 0, inactive: 0 },
      leboncoin: { active: 0, inactive: 0 },
      logicimmo: { active: 0, inactive: 0 },
    };

    for (const row of rows) {
      const bucket = row.isActive ? "active" : "inactive";
      counts[row.source][bucket] = row._count._all;
    }

    return counts;
  }

  async countPriceDrops(): Promise<number> {
    return this.prisma.property.count({
      where: {
        hasPriceDrop: true,
        publications: { some: { isActive: true } },
      },
    });
  }

  async getPriceStats(): Promise<PriceStats | null> {
    const rows = await this.prisma.$queryRaw<{ price: number }[]>`
      SELECT p.price AS price
      FROM properties p
      WHERE EXISTS (
        SELECT 1
        FROM listing_publications lp
        WHERE lp.property_id = p.id
          AND lp.is_active = 1
      )
      ORDER BY p.price ASC
    `;

    if (rows.length === 0) return null;

    const prices = rows.map((row) => row.price);
    const sum = prices.reduce((total, price) => total + price, 0);
    const mid = Math.floor(prices.length / 2);

    const min = prices[0];
    const max = prices[prices.length - 1];

    return {
      count: prices.length,
      min,
      max,
      median:
        prices.length % 2 === 0
          ? Math.round((prices[mid - 1] + prices[mid]) / 2)
          : prices[mid],
      average: Math.round(sum / prices.length),
    };
  }

  async findPriceDrops(limit = 5) {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id AS id
      FROM properties p
      WHERE p.has_price_drop = 1
        AND EXISTS (
          SELECT 1
          FROM listing_publications lp
          WHERE lp.property_id = p.id
            AND lp.is_active = 1
        )
      ORDER BY (p.first_price - p.price) DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const properties = await this.prisma.property.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: propertyInclude,
    });

    const byId = new Map(properties.map((property) => [property.id, property]));

    return rows.flatMap((row) => {
      const propertyRow = byId.get(row.id);
      if (!propertyRow) return [];
      const property = tryToPropertyRow(propertyRow);
      return property ? [property] : [];
    });
  }

  async getTopCities(limit = 5): Promise<CityCount[]> {
    const rows = await this.prisma.property.groupBy({
      by: ["city"],
      where: { publications: { some: { isActive: true } } },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
      take: limit,
    });

    return rows.map((row) => ({
      city: row.city,
      count: row._count._all,
    }));
  }

  async getActivityStats(): Promise<ActivityStats> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [lastScrape, addedLast7Days, deactivatedLast7Days, multiSource] =
      await Promise.all([
        this.prisma.listingPublication.aggregate({
          _max: { scrapedAt: true },
        }),
        this.prisma.property.count({
          where: { firstSeenAt: { gte: since } },
        }),
        this.prisma.listingPublication.count({
          where: { isActive: false, updatedAt: { gte: since } },
        }),
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count
          FROM (
            SELECT property_id
            FROM listing_publications
            WHERE is_active = 1
            GROUP BY property_id
            HAVING COUNT(DISTINCT source) > 1
          )
        `,
      ]);

    return {
      lastScrapedAt: lastScrape._max.scrapedAt,
      addedLast7Days,
      deactivatedLast7Days,
      multiSourceCount: Number(multiSource[0].count),
    };
  }

  private calendarDateKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  async upsertDailySnapshot(): Promise<void> {
    const [activeProperties, activePublications, priceStats, priceDropCount] =
      await Promise.all([
        this.countActiveProperties(),
        this.countPublications(),
        this.getPriceStats(),
        this.countPriceDrops(),
      ]);

    const date = this.calendarDateKey();
    const medianPrice = priceStats?.median ?? 0;

    await this.prisma.statsDailySnapshot.upsert({
      where: { date },
      create: {
        date,
        activeProperties,
        activePublications,
        medianPrice,
        priceDropCount,
      },
      update: {
        activeProperties,
        activePublications,
        medianPrice,
        priceDropCount,
      },
    });
  }

  async getDailySnapshots(since: Date) {
    const sinceKey = this.calendarDateKey(since);
    return this.prisma.statsDailySnapshot.findMany({
      where: { date: { gte: sinceKey } },
      orderBy: { date: "asc" },
    });
  }

  /** Fill missing daily snapshot rows (uses current metrics as bootstrap). */
  async backfillDailySnapshots(days = 90): Promise<number> {
    await this.upsertDailySnapshot();

    const [activeProperties, activePublications, priceStats, priceDropCount] =
      await Promise.all([
        this.countActiveProperties(),
        this.countPublications(),
        this.getPriceStats(),
        this.countPriceDrops(),
      ]);
    const medianPrice = priceStats?.median ?? 0;

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - days + 1);
    const existing = await this.getDailySnapshots(since);
    const existingDates = new Set(existing.map((row) => row.date));

    let filled = 0;
    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);
      const date = this.calendarDateKey(day);
      if (existingDates.has(date)) continue;

      await this.prisma.statsDailySnapshot.create({
        data: {
          date,
          activeProperties,
          activePublications,
          medianPrice,
          priceDropCount,
        },
      });
      filled += 1;
    }

    return filled;
  }

  async getNewPropertiesByDay(
    since: Date
  ): Promise<{ date: string; value: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: string; value: bigint }[]>`
      SELECT date(first_seen_at) AS date, COUNT(*) AS value
      FROM properties
      WHERE first_seen_at >= ${since}
      GROUP BY date(first_seen_at)
      ORDER BY date ASC
    `;
    return rows.map((row) => ({
      date: row.date,
      value: Number(row.value),
    }));
  }

  async getScrapesByDay(
    since: Date
  ): Promise<{ date: string; value: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: string; value: bigint }[]>`
      SELECT date(scraped_at) AS date, COUNT(*) AS value
      FROM listing_publications
      WHERE scraped_at >= ${since}
      GROUP BY date(scraped_at)
      ORDER BY date ASC
    `;
    return rows.map((row) => ({
      date: row.date,
      value: Number(row.value),
    }));
  }

  async getDeactivationsByDay(
    since: Date
  ): Promise<{ date: string; value: number }[]> {
    const rows = await this.prisma.$queryRaw<{ date: string; value: bigint }[]>`
      SELECT date(updated_at) AS date, COUNT(*) AS value
      FROM listing_publications
      WHERE is_active = 0
        AND updated_at >= ${since}
      GROUP BY date(updated_at)
      ORDER BY date ASC
    `;
    return rows.map((row) => ({
      date: row.date,
      value: Number(row.value),
    }));
  }

  async getReactionsByWeek(
    since: Date
  ): Promise<{ week: string; likes: number; dislikes: number }[]> {
    const rows = await this.prisma.$queryRaw<
      { week: string; type: string; value: bigint }[]
    >`
      SELECT strftime('%Y-W%W', created_at) AS week, type, COUNT(*) AS value
      FROM listing_reactions
      WHERE created_at >= ${since}
      GROUP BY week, type
      ORDER BY week ASC
    `;

    const byWeek = new Map<string, { likes: number; dislikes: number }>();
    for (const row of rows) {
      const current = byWeek.get(row.week) ?? { likes: 0, dislikes: 0 };
      if (row.type === "like") current.likes = Number(row.value);
      if (row.type === "dislike") current.dislikes = Number(row.value);
      byWeek.set(row.week, current);
    }

    return [...byWeek.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, counts]) => ({ week, ...counts }));
  }

  async getPriceHistogram(
    bucketCount = 8
  ): Promise<{ label: string; min: number; max: number; count: number }[]> {
    const stats = await this.getPriceStats();
    if (!stats || stats.count === 0) return [];

    const rows = await this.prisma.$queryRaw<{ price: number }[]>`
      SELECT p.price AS price
      FROM properties p
      WHERE EXISTS (
        SELECT 1
        FROM listing_publications lp
        WHERE lp.property_id = p.id
          AND lp.is_active = 1
      )
    `;

    const prices = rows.map((row) => row.price);
    const min = stats.min;
    const max = stats.max;
    if (min === max) {
      return [
        {
          label: formatPriceBucketLabel(min, max),
          min,
          max,
          count: prices.length,
        },
      ];
    }

    const step = Math.ceil((max - min) / bucketCount);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const bucketMin = min + index * step;
      const bucketMax = index === bucketCount - 1 ? max : bucketMin + step - 1;
      return {
        label: formatPriceBucketLabel(bucketMin, bucketMax),
        min: bucketMin,
        max: bucketMax,
        count: 0,
      };
    });

    for (const price of prices) {
      const index = Math.min(Math.floor((price - min) / step), bucketCount - 1);
      buckets[index].count += 1;
    }

    return buckets.filter((bucket) => bucket.count > 0);
  }
}

function formatPriceBucketLabel(min: number, max: number): string {
  const fmt = (value: number) =>
    new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(value);
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}
