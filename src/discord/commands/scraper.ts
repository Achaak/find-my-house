import { SlashCommandBuilder } from "discord.js";
import { formatScrapeSummary } from "../../services/formatScrapeSummary.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geo/geoFilter.js";
import { canRunPrivilegedCommand, denyPrivilegedCommand } from "../auth.js";
import type { CommandHandler } from "./types.js";

export function buildScraperCommand() {
  return new SlashCommandBuilder()
    .setName("scraper")
    .setDescription(
      "Lancer un scraping avec les critères définis dans les variables d'environnement"
    );
}

export const handleScraper: CommandHandler = async (interaction, ctx) => {
  if (!canRunPrivilegedCommand(interaction, ctx.discord.adminRoleId)) {
    await denyPrivilegedCommand(interaction, ctx.discord.adminRoleId);
    return;
  }

  await interaction.deferReply();

  const { city, maxTravelMinutes } = ctx.defaultScrapeOptions;
  const result = await ctx.scraperService.run(ctx.defaultScrapeOptions);

  await ctx.notifyScrapeResults(result);

  const scrapeGeoFilter = resolveGeoFilter({ maxTravelMinutes }, true);
  const zoneLabel =
    scrapeGeoFilter.mode === "city"
      ? ""
      : ` (${geoFilterLabel(scrapeGeoFilter)})`;

  await interaction.editReply(
    formatScrapeSummary(result, {
      city,
      zoneLabel,
      totalProperties: await ctx.repository.count(),
      totalPublications: await ctx.repository.countPublications(),
    })
  );
};
