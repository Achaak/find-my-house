import type { StatsSection } from "@find-my-house/api-types";
import { scrapeConfig } from "../config/scrape.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { PropertyRow } from "../types/listing.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";
import type { ScrapeFilters } from "../types/listing.js";
import { geoFilterLabel, resolveGeoFilter } from "../utils/geo/geoFilter.js";

export type StatsServiceContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  enrichmentQueue: Pick<EnrichmentQueue, "getQueuedCount">;
  scrapeDefaults: ScrapeFilters;
};

export type EnrichmentStatsData = {
  pending: number;
  queued: number;
};

export type StatsOverviewData = {
  total: number;
  activeProperties: number;
  activePublications: number;
  inactivePublications: number;
  priceDrops: number;
  sourceCounts: SourcePublicationCounts;
  priceStats: PriceStats | null;
  topCities: CityCount[];
  activity: ActivityStats;
  likes: number;
  dislikes: number;
  enrichment: EnrichmentStatsData;
  recent: PropertyRow[];
};

export type StatsSourcesData = {
  sourceCounts: SourcePublicationCounts;
  multiSourceCount: number;
};

export type StatsPricesData = {
  priceStats: PriceStats | null;
  priceDrops: number;
  drops: PropertyRow[];
};

export type StatsMineData = {
  likes: number;
  dislikes: number;
  recentLikes: PropertyRow[];
  recentDislikes: PropertyRow[];
};

export type StatsActivityData = {
  activity: ActivityStats;
  enrichment: EnrichmentStatsData;
  zoneLabel: string;
  cron: string;
  scrapers: string[];
  recent: PropertyRow[];
};

export type StatsSectionDataMap = {
  overview: StatsOverviewData;
  sources: StatsSourcesData;
  prices: StatsPricesData;
  mine: StatsMineData;
  activity: StatsActivityData;
};

function formatScrapersLabel(): string {
  const scrapers = scrapeConfig.scrape.scrapers;
  if (!scrapers || scrapers.length === 0) return "all";
  return scrapers.join(", ");
}

function formatZoneLabel(city: string, maxTravelMinutes?: number): string {
  const geoFilter = resolveGeoFilter({ maxTravelMinutes }, true);
  const zone = geoFilterLabel(geoFilter);
  return geoFilter.mode === "city" ? city : `${city} (${zone})`;
}

async function fetchOverview(
  ctx: StatsServiceContext
): Promise<StatsOverviewData> {
  const [
    total,
    activeProperties,
    activePublications,
    inactivePublications,
    priceDrops,
    sourceCounts,
    priceStats,
    topCities,
    activity,
    recent,
    likes,
    dislikes,
    enrichmentPending,
  ] = await Promise.all([
    ctx.repository.count(),
    ctx.repository.countActiveProperties(),
    ctx.repository.countPublications(),
    ctx.repository.countInactivePublications(),
    ctx.repository.countPriceDrops(),
    ctx.repository.getPublicationCountsBySource(),
    ctx.repository.getPriceStats(),
    ctx.repository.getTopCities(3),
    ctx.repository.getActivityStats(),
    ctx.repository.findRecent(3),
    ctx.reactionRepository.countByType("like"),
    ctx.reactionRepository.countByType("dislike"),
    ctx.repository.countPendingDisplayEnrichment(),
  ]);

  return {
    total,
    activeProperties,
    activePublications,
    inactivePublications,
    priceDrops,
    sourceCounts,
    priceStats,
    topCities,
    activity,
    recent,
    likes,
    dislikes,
    enrichment: {
      pending: enrichmentPending,
      queued: ctx.enrichmentQueue.getQueuedCount(),
    },
  };
}

async function fetchSources(
  ctx: StatsServiceContext
): Promise<StatsSourcesData> {
  const [sourceCounts, activity] = await Promise.all([
    ctx.repository.getPublicationCountsBySource(),
    ctx.repository.getActivityStats(),
  ]);

  return {
    sourceCounts,
    multiSourceCount: activity.multiSourceCount,
  };
}

async function fetchPrices(ctx: StatsServiceContext): Promise<StatsPricesData> {
  const [priceStats, priceDrops, drops] = await Promise.all([
    ctx.repository.getPriceStats(),
    ctx.repository.countPriceDrops(),
    ctx.repository.findPriceDrops(5),
  ]);

  return {
    priceStats,
    priceDrops,
    drops,
  };
}

async function fetchMine(ctx: StatsServiceContext): Promise<StatsMineData> {
  const [likes, dislikes, recentLikes, recentDislikes] = await Promise.all([
    ctx.reactionRepository.countByType("like"),
    ctx.reactionRepository.countByType("dislike"),
    ctx.reactionRepository.findListingsByType("like", { limit: 5 }),
    ctx.reactionRepository.findListingsByType("dislike", { limit: 5 }),
  ]);

  return {
    likes,
    dislikes,
    recentLikes,
    recentDislikes,
  };
}

async function fetchActivity(
  ctx: StatsServiceContext
): Promise<StatsActivityData> {
  const { city, maxTravelMinutes } = ctx.scrapeDefaults;
  const [activity, recent, enrichmentPending] = await Promise.all([
    ctx.repository.getActivityStats(),
    ctx.repository.findRecent(5),
    ctx.repository.countPendingDisplayEnrichment(),
  ]);

  return {
    activity,
    enrichment: {
      pending: enrichmentPending,
      queued: ctx.enrichmentQueue.getQueuedCount(),
    },
    zoneLabel: formatZoneLabel(city, maxTravelMinutes),
    cron: scrapeConfig.scrape.cron,
    scrapers: scrapeConfig.scrape.scrapers ?? [],
    recent,
  };
}

export async function fetchStatsSection<S extends StatsSection>(
  section: S,
  ctx: StatsServiceContext
): Promise<StatsSectionDataMap[S]> {
  switch (section) {
    case "overview":
      return (await fetchOverview(ctx)) as StatsSectionDataMap[S];
    case "sources":
      return (await fetchSources(ctx)) as StatsSectionDataMap[S];
    case "prices":
      return (await fetchPrices(ctx)) as StatsSectionDataMap[S];
    case "mine":
      return (await fetchMine(ctx)) as StatsSectionDataMap[S];
    case "activity":
      return (await fetchActivity(ctx)) as StatsSectionDataMap[S];
    default: {
      const exhaustive: never = section;
      throw new Error(`Unknown stats section: ${String(exhaustive)}`);
    }
  }
}

export function formatStatsScrapersLabel(): string {
  return formatScrapersLabel();
}

export function formatStatsZoneLabel(
  city: string,
  maxTravelMinutes?: number
): string {
  return formatZoneLabel(city, maxTravelMinutes);
}
