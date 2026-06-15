import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import { displayEnrichmentPendingWhere } from "../domain/enrichmentCriteria.js";
import { propertyInclude } from "./propertyInclude.js";
import { toPropertyRow } from "./listingMapper.js";

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
      where: displayEnrichmentPendingWhere(),
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

    return rows
      .map((row) => byId.get(row.id))
      .filter((property): property is NonNullable<typeof property> =>
        Boolean(property)
      )
      .map(toPropertyRow);
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
}
