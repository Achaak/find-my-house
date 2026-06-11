import { SlashCommandBuilder } from "discord.js";
import { config } from "../../config.js";
import { geoFilterLabel, resolveGeoFilter } from "../../utils/geo/geoFilter.js";
import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../notifications.js";
import type { CommandHandler } from "./types.js";

export function buildScraperCommand() {
  return new SlashCommandBuilder()
    .setName("scraper")
    .setDescription(
      "Lancer un scraping avec les critères définis dans les variables d'environnement"
    );
}

export const handleScraper: CommandHandler = async (interaction, ctx) => {
  await interaction.deferReply();

  const { city, radiusKm, maxTravelMinutes } = ctx.defaultScrapeOptions;
  const result = await ctx.scraperService.run(ctx.defaultScrapeOptions);

  if (config.discord.channelId) {
    if (result.insertedListings.length > 0) {
      await sendNewListingNotifications(
        config.discord.token,
        config.discord.channelId,
        result.insertedListings,
        ctx.repository
      );
    }
    if (result.priceDropListings.length > 0) {
      await sendPriceDropNotifications(
        config.discord.token,
        config.discord.channelId,
        result.priceDropListings,
        ctx.repository
      );
    }
  }

  const scrapeGeoFilter = resolveGeoFilter(
    { maxTravelMinutes, radiusKm },
    true
  );
  const zoneLabel =
    scrapeGeoFilter.mode === "city"
      ? ""
      : ` (${geoFilterLabel(scrapeGeoFilter)})`;

  await interaction.editReply(
    [
      `Scraping terminé pour **${city}**${zoneLabel}`,
      `📥 ${String(result.found)} trouvées`,
      `✅ ${String(result.inserted)} nouveaux biens`,
      `🔗 ${String(result.linked)} publications liées (doublon inter-sites)`,
      `🔄 ${String(result.updated)} mises à jour`,
      `📉 ${String(result.priceDropListings.length)} baisse(s) de prix`,
      `⏭️ ${String(result.skipped)} inchangées`,
      `📊 Total: **${String(await ctx.repository.count())}** biens, **${String(await ctx.repository.countPublications())}** publications`,
    ].join("\n")
  );
};
