import cron from "node-cron";
import type { ScrapeFilters } from "./types/listing.js";
import { config } from "./config.js";
import { ListingRepository } from "./db/listingRepository.js";
import { ReactionRepository } from "./db/reactionRepository.js";
import { disconnectPrisma, getPrisma } from "./db/prisma.js";
import { startDiscordBot } from "./discord/bot.js";
import { sendNewListingNotifications } from "./discord/notifications.js";
import { createScrapers } from "./scrapers/index.js";
import { ScraperService } from "./services/scraperService.js";
import { geoFilterLabel, resolveGeoFilter } from "./utils/geoFilter.js";

async function shutdown(): Promise<void> {
  await disconnectPrisma();
}

async function main(): Promise<void> {
  const scrapers = createScrapers();
  const prisma = getPrisma(config.database.url);
  const repository = new ListingRepository(prisma);
  const reactionRepository = new ReactionRepository(prisma);
  const scraperService = new ScraperService(scrapers, repository);

  const scrapeOptions: ScrapeFilters = {
    city: config.scrape.city,
    maxPrice: config.scrape.maxPrice,
    minSurface: config.scrape.minSurface,
    minLandSurface: config.scrape.minLandSurface,
    minRooms: config.scrape.minRooms,
    minBedrooms: config.scrape.minBedrooms,
    ancienOnly: config.scrape.ancienOnly,
    radiusKm: config.scrape.radiusKm,
    maxTravelMinutes: config.scrape.maxTravelMinutes,
  };

  const geoFilter = resolveGeoFilter(scrapeOptions, true);

  console.log("[app] Démarrage de Find My House...");
  console.log(`[app] Base: ${config.database.url}`);
  console.log(
    `[app] Scrapers actifs: ${scrapers.map((s) => s.name).join(", ") || "aucun"}`
  );
  console.log(
    `[app] Zone de recherche: ${scrapeOptions.city} (${geoFilterLabel(geoFilter)})`
  );

  if (cron.validate(config.scrape.cron)) {
    cron.schedule(config.scrape.cron, async () => {
      console.log("[cron] Scraping automatique...");
      try {
        const result = await scraperService.run(scrapeOptions);
        console.log(
          `[cron] Résultat: ${String(result.inserted)} nouvelles, ${String(result.updated)} MAJ, ${String(result.skipped)} ignorées`
        );
        if (config.discord.channelId && result.insertedListings.length > 0) {
          const sent = await sendNewListingNotifications(
            config.discord.token,
            config.discord.channelId,
            result.insertedListings
          );
          console.log(
            `[cron] Discord: ${String(sent)} notification(s) envoyée(s)`
          );
        }
      } catch (error) {
        console.error("[cron] Erreur scraping:", error);
      }
    });
    console.log(`[cron] Planifié: ${config.scrape.cron}`);
  }

  const stop = async (signal: string) => {
    console.log(`[app] Arrêt (${signal})...`);
    await shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await startDiscordBot({
    token: config.discord.token,
    clientId: config.discord.clientId,
    guildId: config.discord.guildId,
    repository,
    reactionRepository,
    scraperService,
    scrapeDefaults: scrapeOptions,
  });
}

main().catch((error: unknown) => {
  console.error("[app] Erreur fatale:", error);
  process.exit(1);
});
