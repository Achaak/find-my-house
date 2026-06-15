import { SlashCommandBuilder } from "discord.js";
import {
  fetchStatsSection,
  formatStatsScrapersLabel,
  formatStatsZoneLabel,
} from "../../services/statsService.js";
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
      sub.setName("mine").setDescription("Household favorites and dislikes")
    )
    .addSubcommand((sub) =>
      sub
        .setName("activity")
        .setDescription("Recent activity and configuration")
    );
}

export const handleStats: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply();

  const statsCtx = {
    repository: ctx.repository,
    reactionRepository: ctx.reactionRepository,
    enrichmentQueue: ctx.enrichmentQueue,
    scrapeDefaults: ctx.defaultScrapeOptions,
  };

  switch (subcommand) {
    case "overview": {
      const overview = await fetchStatsSection("overview", statsCtx);
      await interaction.editReply({
        embeds: [formatOverviewStatsEmbed(overview)],
      });
      return;
    }

    case "sources": {
      const sources = await fetchStatsSection("sources", statsCtx);
      await interaction.editReply({
        embeds: [
          formatSourcesStatsEmbed(
            sources.sourceCounts,
            sources.multiSourceCount
          ),
        ],
      });
      return;
    }

    case "prices": {
      const prices = await fetchStatsSection("prices", statsCtx);
      await interaction.editReply({
        embeds: [
          formatPricesStatsEmbed(
            prices.priceStats,
            prices.priceDrops,
            prices.drops
          ),
        ],
      });
      return;
    }

    case "mine": {
      const mine = await fetchStatsSection("mine", statsCtx);
      await interaction.editReply({
        embeds: [formatMineStatsEmbed(mine)],
      });
      return;
    }

    case "activity": {
      const activity = await fetchStatsSection("activity", statsCtx);
      const { city, maxTravelMinutes } = ctx.defaultScrapeOptions;
      await interaction.editReply({
        embeds: [
          formatActivityStatsEmbed({
            activity: activity.activity,
            enrichment: activity.enrichment,
            zoneLabel: formatStatsZoneLabel(city, maxTravelMinutes),
            cron: activity.cron,
            scrapersLabel: formatStatsScrapersLabel(),
            recent: activity.recent,
          }),
        ],
      });
      return;
    }
  }
};
