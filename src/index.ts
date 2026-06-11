import cron from "node-cron";
import { buildScrapeFilters, config } from "./config.js";
import { ListingRepository } from "./db/listingRepository.js";
import { ReactionRepository } from "./db/reactionRepository.js";
import { disconnectPrisma, getPrisma } from "./db/prisma.js";
import { startDiscordBot } from "./discord/bot.js";
import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "./discord/notifications.js";
import { createScrapers } from "./scrapers/index.js";
import { ScraperService } from "./services/scraperService.js";
import { formatVersionLine } from "./version.js";
import { geoFilterLabel, resolveGeoFilter } from "./utils/geoFilter.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("app");
const cronLog = createLogger("cron");

async function shutdown(): Promise<void> {
  await disconnectPrisma();
}

async function main(): Promise<void> {
  const scrapers = createScrapers();
  const prisma = getPrisma(config.database.url);
  const repository = new ListingRepository(prisma);
  const reactionRepository = new ReactionRepository(prisma);
  const scraperService = new ScraperService(scrapers, repository);

  const scrapeOptions = buildScrapeFilters();
  const geoFilter = resolveGeoFilter(scrapeOptions, true);

  log.info(`Démarrage de Find My House ${formatVersionLine()}...`);
  log.info(`Base: ${config.database.url}`);
  log.info(
    `Scrapers actifs: ${scrapers.map((s) => s.name).join(", ") || "aucun"}`
  );
  log.info(
    `Zone de recherche: ${scrapeOptions.city} (${geoFilterLabel(geoFilter)})`
  );

  if (cron.validate(config.scrape.cron)) {
    cron.schedule(config.scrape.cron, async () => {
      cronLog.info("Scraping automatique...");
      try {
        const result = await scraperService.run(scrapeOptions);
        cronLog.info(
          `Résultat: ${String(result.inserted)} nouveaux biens, ${String(result.linked)} liées, ${String(result.updated)} MAJ, ${String(result.skipped)} ignorées`
        );
        if (config.discord.channelId) {
          if (result.insertedListings.length > 0) {
            const sent = await sendNewListingNotifications(
              config.discord.token,
              config.discord.channelId,
              result.insertedListings,
              repository
            );
            cronLog.info(`Discord: ${String(sent)} nouvelle(s) annonce(s)`);
          }
          if (result.priceDropListings.length > 0) {
            const sent = await sendPriceDropNotifications(
              config.discord.token,
              config.discord.channelId,
              result.priceDropListings,
              repository
            );
            cronLog.info(`Discord: ${String(sent)} baisse(s) de prix`);
          }
        }
      } catch (error) {
        cronLog.error("Erreur scraping:", error);
      }
    });
    cronLog.info(`Planifié: ${config.scrape.cron}`);
  }

  const stop = async (signal: string) => {
    log.info(`Arrêt (${signal})...`);
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
  log.error("Erreur fatale:", error);
  process.exit(1);
});
