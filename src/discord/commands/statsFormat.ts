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
    return `**${formatSourceLabel(source)}** : ${String(active)} active${active > 1 ? "s" : ""}${inactiveSuffix}`;
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
  if (cities.length === 0) return "_Aucune ville_";
  return cities
    .map((entry) => `${entry.city} (${String(entry.count)})`)
    .join(" · ");
}

function formatPriceRange(stats: PriceStats | null): string {
  if (!stats) return "_Aucun bien actif_";
  return `${formatPrice(stats.min)} – ${formatPrice(stats.max)} (médiane ${formatPrice(stats.median)})`;
}

function formatRecentListings(recent: PropertyRow[]): string {
  if (recent.length === 0) return "_Aucune annonce pour le moment_";

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
  if (!date) return "_Jamais_";
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
    title: "Statistiques — Vue d'ensemble",
    description: [
      `**${String(input.activeProperties)}** biens actifs / **${String(input.total)}** en base`,
      `**${String(input.activePublications)}** publications actives · **${String(input.inactivePublications)}** inactives`,
      input.priceDrops > 0
        ? `**${String(input.priceDrops)}** baisse(s) de prix en cours`
        : null,
    ]
      .filter((line): line is string => line !== null)
      .join("\n"),
    fields: [
      ...(sourceSummary
        ? [{ name: "Sources", value: sourceSummary, inline: false }]
        : []),
      {
        name: "Prix",
        value: formatPriceRange(input.priceStats),
        inline: false,
      },
      {
        name: "Top villes",
        value: formatCitySummary(input.topCities),
        inline: false,
      },
      {
        name: "Activité (7 jours)",
        value: [
          `Dernier scrape : ${formatScrapedAt(input.activity.lastScrapedAt)}`,
          `**${String(input.activity.addedLast7Days)}** nouveau(x) bien(s)`,
          `**${String(input.activity.deactivatedLast7Days)}** publication(s) désactivée(s)`,
          `**${String(input.activity.multiSourceCount)}** bien(s) multi-sources`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Vos réactions",
        value: `❤️ **${String(input.likes)}** · 👎 **${String(input.dislikes)}**`,
        inline: false,
      },
      {
        name: "Derniers biens",
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
    title: "Statistiques — Sources",
    description: `**${String(totalActive)}** publications actives · **${String(totalInactive)}** inactives`,
    fields: [
      {
        name: "Par portail",
        value: lines || "_Aucune publication_",
        inline: false,
      },
      {
        name: "Multi-sources",
        value: `**${String(multiSourceCount)}** bien(s) référencé(s) sur plusieurs portails`,
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
        name: "Fourchette",
        value: `${formatPrice(stats.min)} – ${formatPrice(stats.max)}`,
        inline: true,
      },
      {
        name: "Médiane",
        value: formatPrice(stats.median),
        inline: true,
      },
      {
        name: "Moyenne",
        value: formatPrice(stats.average),
        inline: true,
      },
      {
        name: "Biens actifs",
        value: String(stats.count),
        inline: true,
      },
      {
        name: "Baisses en cours",
        value: String(priceDrops),
        inline: true,
      }
    );
  } else {
    fields.push({
      name: "Prix",
      value: "_Aucun bien actif_",
      inline: false,
    });
  }

  fields.push({
    name: priceDrops > 0 ? "Plus fortes baisses" : "Baisses de prix",
    value:
      drops.length > 0
        ? drops.map(formatPriceDropLine).join("\n").slice(0, 1024)
        : "_Aucune baisse en cours_",
    inline: false,
  });

  return {
    color: EMBED_COLOR,
    title: "Statistiques — Prix",
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
    title: "Statistiques — Mes réactions",
    description: `❤️ **${String(input.likes)}** favori${input.likes > 1 ? "s" : ""} · 👎 **${String(input.dislikes)}** non-favori${input.dislikes > 1 ? "s" : ""}`,
    fields: [
      {
        name: "Favoris récents",
        value: formatReactionList(input.recentLikes, "_Aucun favori_"),
        inline: false,
      },
      {
        name: "Non-favoris récents",
        value: formatReactionList(input.recentDislikes, "_Aucun non-favori_"),
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
    title: "Statistiques — Activité",
    description: `Zone : **${input.zoneLabel}**`,
    fields: [
      {
        name: "Scraping",
        value: [
          `Dernier scrape : ${formatScrapedAt(input.activity.lastScrapedAt)}`,
          `Planification : \`${input.cron}\``,
          `Scrapers : ${input.scrapersLabel}`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "7 derniers jours",
        value: [
          `**${String(input.activity.addedLast7Days)}** nouveau(x) bien(s)`,
          `**${String(input.activity.deactivatedLast7Days)}** publication(s) désactivée(s)`,
          `**${String(input.activity.multiSourceCount)}** bien(s) multi-sources`,
        ].join("\n"),
        inline: false,
      },
      {
        name: "Derniers ajouts",
        value: formatRecentListings(input.recent),
        inline: false,
      },
    ],
  };
}
