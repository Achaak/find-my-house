import { SlashCommandBuilder } from "discord.js";
import { scrapeConfig } from "../../config/scrape.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geo/geoFilter.js";
import {
  formatActivityStatsEmbed,
  formatMineStatsEmbed,
  formatOverviewStatsEmbed,
  formatPricesStatsEmbed,
  formatSourcesStatsEmbed,
} from "./statsFormat.js";
import type { CommandHandler } from "./types.js";

export function buildStatsCommand() {
  return new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Listing database statistics")
    .addSubcommand((sub) =>
      sub.setName("overview").setDescription("Database overview")
    )
    .addSubcommand((sub) =>
      sub.setName("sources").setDescription("Breakdown by portal")
    )
    .addSubcommand((sub) =>
      sub.setName("prices").setDescription("Price and drop statistics")
    )
    .addSubcommand((sub) =>
      sub.setName("mine").setDescription("Your favorites and dislikes")
    )
    .addSubcommand((sub) =>
      sub
        .setName("activity")
        .setDescription("Recent activity and configuration")
    );
}

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

export const handleStats: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply();

  switch (subcommand) {
    case "overview": {
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
        ctx.reactionRepository.countByUser(interaction.user.id, "like"),
        ctx.reactionRepository.countByUser(interaction.user.id, "dislike"),
      ]);

      await interaction.editReply({
        embeds: [
          formatOverviewStatsEmbed({
            total,
            activeProperties,
            activePublications,
            inactivePublications,
            priceDrops,
            sourceCounts,
            priceStats,
            topCities,
            activity,
            likes,
            dislikes,
            recent,
          }),
        ],
      });
      return;
    }

    case "sources": {
      const [sourceCounts, activity] = await Promise.all([
        ctx.repository.getPublicationCountsBySource(),
        ctx.repository.getActivityStats(),
      ]);

      await interaction.editReply({
        embeds: [
          formatSourcesStatsEmbed(sourceCounts, activity.multiSourceCount),
        ],
      });
      return;
    }

    case "prices": {
      const [priceStats, priceDrops, drops] = await Promise.all([
        ctx.repository.getPriceStats(),
        ctx.repository.countPriceDrops(),
        ctx.repository.findPriceDrops(5),
      ]);

      await interaction.editReply({
        embeds: [formatPricesStatsEmbed(priceStats, priceDrops, drops)],
      });
      return;
    }

    case "mine": {
      const discordUserId = interaction.user.id;
      const [likes, dislikes, recentLikes, recentDislikes] = await Promise.all([
        ctx.reactionRepository.countByUser(discordUserId, "like"),
        ctx.reactionRepository.countByUser(discordUserId, "dislike"),
        ctx.reactionRepository.findListingsByUser(discordUserId, "like", 5),
        ctx.reactionRepository.findListingsByUser(discordUserId, "dislike", 5),
      ]);

      await interaction.editReply({
        embeds: [
          formatMineStatsEmbed({
            likes,
            dislikes,
            recentLikes,
            recentDislikes,
          }),
        ],
      });
      return;
    }

    case "activity": {
      const { city, maxTravelMinutes } = ctx.defaultScrapeOptions;
      const [activity, recent] = await Promise.all([
        ctx.repository.getActivityStats(),
        ctx.repository.findRecent(5),
      ]);

      await interaction.editReply({
        embeds: [
          formatActivityStatsEmbed({
            activity,
            zoneLabel: formatZoneLabel(city, maxTravelMinutes),
            cron: scrapeConfig.scrape.cron,
            scrapersLabel: formatScrapersLabel(),
            recent,
          }),
        ],
      });
      return;
    }
  }
};
