import { discordConfig } from "../config/discord.js";
import { buildScrapeFilters, scrapeConfig } from "../config/scrape.js";
import { ListingRepository } from "../db/listingRepository.js";
import { ReactionRepository } from "../db/reactionRepository.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { createScrapers } from "../scrapers/index.js";
import { notifyScrapeResults } from "../services/notifyScrapeResults.js";
import { ScraperService } from "../services/scraperService.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("scrape-once");

async function main(): Promise<void> {
  const prisma = getPrisma(scrapeConfig.database.url);
  const repository = new ListingRepository(prisma);
  const reactionRepository = new ReactionRepository(prisma);
  const scraperService = new ScraperService(createScrapers(), repository);

  try {
    const scrapeOptions = buildScrapeFilters();
    const result = await scraperService.run(scrapeOptions);

    log.info("Résultat du scraping:");
    log.info(`  Trouvées:   ${String(result.found)}`);
    log.info(`  Nouveaux:   ${String(result.inserted)}`);
    log.info(`  Liées:      ${String(result.linked)}`);
    log.info(`  MAJ:        ${String(result.updated)}`);
    log.info(`  Baisses:    ${String(result.priceDropListings.length)}`);
    log.info(`  Ignorées:   ${String(result.skipped)}`);
    log.info(`  Désactivées: ${String(result.deactivated)}`);
    log.info(`  Total BDD:  ${String(await repository.count())} biens`);

    await notifyScrapeResults(result, {
      token: discordConfig.discord.token,
      channelId: discordConfig.discord.channelId,
      maxNotifications: discordConfig.discord.maxNotifications,
      reactionRepository,
      log,
    });
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  log.error("Erreur fatale:", error);
  process.exit(1);
});
