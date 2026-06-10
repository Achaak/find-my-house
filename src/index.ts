import cron from "node-cron";
import { config } from "./config.js";
import { ListingRepository } from "./db/listingRepository.js";
import { disconnectPrisma, getPrisma } from "./db/prisma.js";
import { startDiscordBot } from "./discord/bot.js";
import { sendNewListingNotifications } from "./discord/webhook.js";
import { BrowserManager, createScrapers } from "./scrapers/index.js";
import { ScraperService } from "./services/scraperService.js";

async function shutdown(browser: BrowserManager): Promise<void> {
  await browser.close();
  await disconnectPrisma();
}

async function main(): Promise<void> {
  const prisma = getPrisma(config.database.url);
  const repository = new ListingRepository(prisma);
  const browser = new BrowserManager();
  const scrapers = createScrapers(browser);
  const scraperService = new ScraperService(scrapers, repository);

  const scrapeOptions = {
    city: config.scrape.city,
    maxPrice: config.scrape.maxPrice,
    minSurface: config.scrape.minSurface,
  };

  console.log("[app] Démarrage de Find My House...");
  console.log(`[app] Base: ${config.database.url}`);
  console.log(`[app] Ville par défaut: ${scrapeOptions.city}`);

  if (cron.validate(config.scrape.cron)) {
    cron.schedule(config.scrape.cron, async () => {
      console.log("[cron] Scraping automatique...");
      const result = await scraperService.run(scrapeOptions);
      console.log(
        `[cron] Résultat: ${result.inserted} nouvelles, ${result.updated} MAJ, ${result.skipped} ignorées`
      );
      if (config.discord.webhookUrl && result.insertedListings.length > 0) {
        await sendNewListingNotifications(
          config.discord.webhookUrl,
          result.insertedListings
        );
      }
    });
    console.log(`[cron] Planifié: ${config.scrape.cron}`);
  }

  const stop = async (signal: string) => {
    console.log(`[app] Arrêt (${signal})...`);
    await shutdown(browser);
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  await startDiscordBot({
    token: config.discord.token,
    clientId: config.discord.clientId,
    guildId: config.discord.guildId,
    repository,
    scraperService,
    scrapeDefaults: scrapeOptions,
  });
}

main().catch((error) => {
  console.error("[app] Erreur fatale:", error);
  process.exit(1);
});
