import cron from "node-cron";
import "./config/app.js";
import { discordConfig } from "./config/discord.js";
import { buildScrapeFilters, scrapeConfig } from "./config/scrape.js";
import { ListingRepository } from "./db/listingRepository.js";
import { ReactionRepository } from "./db/reactionRepository.js";
import { disconnectPrisma, getPrisma } from "./db/prisma.js";
import { startDiscordBot } from "./discord/bot.js";
import { createScrapers } from "./scrapers/index.js";
import { formatScrapeErrors } from "./services/formatScrapeSummary.js";
import { notifyScrapeResults } from "./services/notifyScrapeResults.js";
import { ScraperService } from "./services/scraperService.js";
import { formatVersionLine } from "./version.js";
import { geoFilterLabel, resolveGeoFilter } from "./utils/geo/geoFilter.js";
import { createLogger } from "./utils/logger.js";

const log = createLogger("app");
const cronLog = createLogger("cron");

async function shutdown(): Promise<void> {
  await disconnectPrisma();
}

async function main(): Promise<void> {
  const scrapers = createScrapers();
  const prisma = getPrisma(scrapeConfig.database.url);
  const repository = new ListingRepository(prisma);
  const reactionRepository = new ReactionRepository(prisma);
  const scraperService = new ScraperService(scrapers, repository);

  const scrapeOptions = buildScrapeFilters();
  const geoFilter = resolveGeoFilter(scrapeOptions, true);
  const { discord } = discordConfig;

  log.info(`Démarrage de Find My House ${formatVersionLine()}...`);
  log.info(`Base: ${scrapeConfig.database.url}`);
  log.info(
    `Scrapers actifs: ${scrapers.map((s) => s.name).join(", ") || "aucun"}`
  );
  log.info(
    `Zone de recherche: ${scrapeOptions.city} (${geoFilterLabel(geoFilter)})`
  );

  if (cron.validate(scrapeConfig.scrape.cron)) {
    cron.schedule(scrapeConfig.scrape.cron, async () => {
      cronLog.info("Scraping automatique...");
      try {
        const result = await scraperService.run(scrapeOptions);
        cronLog.info(
          `Résultat: ${String(result.inserted)} nouveaux biens, ${String(result.linked)} liées, ${String(result.updated)} MAJ, ${String(result.skipped)} ignorées, ${String(result.deactivated)} désactivées`
        );
        for (const line of formatScrapeErrors(result.errors)) {
          cronLog.warn(line);
        }
        await notifyScrapeResults(result, {
          token: discord.token,
          channelId: discord.channelId,
          maxNotifications: discord.maxNotifications,
          reactionRepository,
          log: cronLog,
        });
      } catch (error) {
        cronLog.error("Erreur scraping:", error);
      }
    });
    cronLog.info(`Planifié: ${scrapeConfig.scrape.cron}`);
  } else {
    cronLog.error(
      `Expression cron invalide: "${scrapeConfig.scrape.cron}" — scraping automatique désactivé`
    );
  }

  const stop = async (signal: string) => {
    log.info(`Arrêt (${signal})...`);
    await shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await startDiscordBot({
    discord,
    clientId: discord.clientId,
    guildId: discord.guildId,
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
