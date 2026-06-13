import type { PropertyRow } from "../../types/listing.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../../types/stats.js";
import { formatPrice, formatSourceLabel } from "../format.js";

const EMBED_COLOR = 0x5865f2;
const LISTING_SOURCES = [
  "bienici",
  "seloger",
  "leboncoin",
  "logicimmo",
] as const;

type StatsEmbed = {
  color: number;
  title: string;
  description?: string;
  fields: { name: string; value: string; inline?: boolean }[];
};

function formatSourceLine(counts: SourcePublicationCounts): string {
  return LISTING_SOURCES.map((source) => {
    const { active, inactive } = counts[source];
    const total = active + inactive;
    if (total === 0) return null;
    const inactiveSuffix =
      inactive > 0
        ? ` (${String(inactive)} inactive${inactive > 1 ? "s" : ""})`
        : "";
    return `**${formatSourceLabel(source)}**: ${String(active)} active${active > 1 ? "s" : ""}${inactiveSuffix}`;
  })
    .filter((line): line is string => line !== null)
    .join("\n");
}

function formatSourceSummary(counts: SourcePublicationCounts): string {
  return LISTING_SOURCES.map((source) => {
    const active = counts[source].active;
    if (active === 0) return null;
    return `${formatSourceLabel(source)} ${String(active)}`;
  })
    .filter((line): line is string => line !== null)
    .join(" · ");
}

function formatCitySummary(cities: CityCount[]): string {
  if (cities.length === 0) return "_No cities_";
  return cities
    .map((entry) => `${entry.city} (${String(entry.count)})`)
    .join(" · ");
}

function formatPriceRange(stats: PriceStats | null): string {
  if (!stats) return "_No active properties_";
  return `${formatPrice(stats.min)} – ${formatPrice(stats.max)} (median ${formatPrice(stats.median)})`;
}

function formatRecentListings(recent: PropertyRow[]): string {
  if (recent.length === 0) return "_No listings yet_";

  return recent
    .map((listing) => {
      const sources = [
        ...new Set(
          listing.publications
            .filter((publication) => publication.isActive)
            .map((publication) => publication.source)
        ),
      ]
        .map(formatSourceLabel)
        .join(", ");
      return `• **#${String(listing.id)}** ${listing.title}\n  ${listing.city} · ${sources}`;
    })
    .join("\n")
    .slice(0, 1024);
}

function formatPriceDropLine(property: PropertyRow): string {
  const drop = property.firstPrice - property.price;
  const pct = Math.round((drop / property.firstPrice) * 100);
  return `• **#${String(property.id)}** ${formatPrice(property.price)} (−${formatPrice(drop)}, −${String(pct)} %)\n  ${property.title}`;
}

function formatScrapedAt(date: Date | null): string {
  if (!date) return "_Never_";
  return `<t:${String(Math.floor(date.getTime() / 1000))}:R>`;
}

export type OverviewStatsInput = {
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
  recent: PropertyRow[];
};

export function formatOverviewStatsEmbed(
  input: OverviewStatsInput
): StatsEmbed {
  const sourceSummary = formatSourceSummary(input.sourceCounts);

  return {
    color: EMBED_COLOR,
    title: "Statistics — Overview",
    description: [
      `**${String(input.activeProperties)}** active properties / **${String(input.total)}** in database`,
      `**${String(input.activePublications)}** active publications · **${String(input.inactivePublications)}** inactive`,
      input.priceDrops > 0
        ? `**${String(input.priceDrops)}** ongoing price drop(s)`
        : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    fields: [
      ...(sourceSummary
        ? [{ name: "Sources", value: sourceSummary, inline: false }]
        : []),
      {
        name: "Price",
        value: formatPriceRange(input.priceStats),
        inline: false,
      },
      {
        name: "Top cities",
        value: formatCitySummary(input.topCities),
        inline: false,
      },
      {
        name: "Activity (7 days)",
        value: [
          `Last scrape: ${formatScrapedAt(input.activity.lastScrapedAt)}`,
          `**${String(input.activity.addedLast7Days)}** new propert${input.activity.addedLast7Days === 1 ? "y" : "ies"}`,
          `**${String(input.activity.deactivatedLast7Days)}** publication(s) deactivated`,
          `**${String(input.activity.multiSourceCount)}** multi-source propert${input.activity.multiSourceCount === 1 ? "y" : "ies"}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Your reactions",
        value: `❤️ **${String(input.likes)}** · 👎 **${String(input.dislikes)}**`,
        inline: false,
      },
      {
        name: "Recent properties",
        value: formatRecentListings(input.recent),
        inline: false,
      },
    ],
  };
}

export function formatSourcesStatsEmbed(
  counts: SourcePublicationCounts,
  multiSourceCount: number
): StatsEmbed {
  const lines = formatSourceLine(counts);
  const totalActive = LISTING_SOURCES.reduce(
    (sum, source) => sum + counts[source].active,
    0
  );
  const totalInactive = LISTING_SOURCES.reduce(
    (sum, source) => sum + counts[source].inactive,
    0
  );

  return {
    color: EMBED_COLOR,
    title: "Statistics — Sources",
    description: `**${String(totalActive)}** active publications · **${String(totalInactive)}** inactive`,
    fields: [
      {
        name: "By portal",
        value: lines || "_No publications_",
        inline: false,
      },
      {
        name: "Multi-source",
        value: `**${String(multiSourceCount)}** propert${multiSourceCount === 1 ? "y" : "ies"} listed on multiple portals`,
        inline: false,
      },
    ],
  };
}

export function formatPricesStatsEmbed(
  stats: PriceStats | null,
  priceDrops: number,
  drops: PropertyRow[]
): StatsEmbed {
  const fields: StatsEmbed["fields"] = [];

  if (stats) {
    fields.push(
      {
        name: "Range",
        value: `${formatPrice(stats.min)} – ${formatPrice(stats.max)}`,
        inline: true,
      },
      {
        name: "Median",
        value: formatPrice(stats.median),
        inline: true,
      },
      {
        name: "Average",
        value: formatPrice(stats.average),
        inline: true,
      },
      {
        name: "Active properties",
        value: String(stats.count),
        inline: true,
      },
      {
        name: "Ongoing drops",
        value: String(priceDrops),
        inline: true,
      }
    );
  } else {
    fields.push({
      name: "Price",
      value: "_No active properties_",
      inline: false,
    });
  }

  fields.push({
    name: priceDrops > 0 ? "Largest drops" : "Price drops",
    value:
      drops.length > 0
        ? drops.map(formatPriceDropLine).join("\n").slice(0, 1024)
        : "_No ongoing price drops_",
    inline: false,
  });

  return {
    color: EMBED_COLOR,
    title: "Statistics — Prices",
    fields,
  };
}

export type MineStatsInput = {
  likes: number;
  dislikes: number;
  recentLikes: PropertyRow[];
  recentDislikes: PropertyRow[];
};

function formatReactionList(
  listings: PropertyRow[],
  emptyLabel: string
): string {
  if (listings.length === 0) return emptyLabel;

  return listings
    .map(
      (listing) =>
        `• **#${String(listing.id)}** ${listing.title} — ${formatPrice(listing.price)}`
    )
    .join("\n")
    .slice(0, 1024);
}

export function formatMineStatsEmbed(input: MineStatsInput): StatsEmbed {
  return {
    color: EMBED_COLOR,
    title: "Statistics — My reactions",
    description: `❤️ **${String(input.likes)}** favorite${input.likes > 1 ? "s" : ""} · 👎 **${String(input.dislikes)}** dislike${input.dislikes > 1 ? "s" : ""}`,
    fields: [
      {
        name: "Recent favorites",
        value: formatReactionList(input.recentLikes, "_No favorites_"),
        inline: false,
      },
      {
        name: "Recent dislikes",
        value: formatReactionList(input.recentDislikes, "_No dislikes_"),
        inline: false,
      },
    ],
  };
}

export type ActivityStatsInput = {
  activity: ActivityStats;
  zoneLabel: string;
  cron: string;
  scrapersLabel: string;
  recent: PropertyRow[];
};

export function formatActivityStatsEmbed(
  input: ActivityStatsInput
): StatsEmbed {
  return {
    color: EMBED_COLOR,
    title: "Statistics — Activity",
    description: `Area: **${input.zoneLabel}**`,
    fields: [
      {
        name: "Scraping",
        value: [
          `Last scrape: ${formatScrapedAt(input.activity.lastScrapedAt)}`,
          `Schedule: \`${input.cron}\``,
          `Scrapers: ${input.scrapersLabel}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Last 7 days",
        value: [
          `**${String(input.activity.addedLast7Days)}** new propert${input.activity.addedLast7Days === 1 ? "y" : "ies"}`,
          `**${String(input.activity.deactivatedLast7Days)}** publication(s) deactivated`,
          `**${String(input.activity.multiSourceCount)}** multi-source propert${input.activity.multiSourceCount === 1 ? "y" : "ies"}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Recent additions",
        value: formatRecentListings(input.recent),
        inline: false,
      },
    ],
  };
}
