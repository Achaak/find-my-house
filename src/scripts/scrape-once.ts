import { parseDiscordConfigOptional } from "../config/schema.js";
import { buildScrapeFilters, scrapeConfig } from "../config/scrape.js";
import { ListingRepository } from "../db/listingRepository.js";
import { ReactionRepository } from "../db/reactionRepository.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { createScrapers } from "../scrapers/index.js";
import { notifyScrapeResults } from "../services/notifyScrapeResults.js";
import { ScraperService } from "../services/scraperService.js";
import { createLogger } from "../utils/logger.js";
import { closeBrowserContext } from "../utils/browser/client.js";

const log = createLogger("scrape-once");

async function main(): Promise<void> {
  const prisma = getPrisma(scrapeConfig.database.url);
  const repository = new ListingRepository(prisma);
  const reactionRepository = new ReactionRepository(prisma);
  const scraperService = new ScraperService(createScrapers(), repository);

  try {
    const scrapeOptions = buildScrapeFilters();
    const result = await scraperService.run(scrapeOptions);

    log.info("Scrape result:");
    log.info(`  Found:       ${String(result.found)}`);
    log.info(`  New:         ${String(result.inserted)}`);
    log.info(`  Linked:      ${String(result.linked)}`);
    log.info(`  Updated:     ${String(result.updated)}`);
    log.info(`  Price drops: ${String(result.priceDropListings.length)}`);
    log.info(`  Skipped:     ${String(result.skipped)}`);
    log.info(`  Deactivated: ${String(result.deactivated)}`);
    log.info(`  DB total:    ${String(await repository.count())} properties`);

    const discord = parseDiscordConfigOptional();
    if (discord?.discord.channelId) {
      await notifyScrapeResults(result, {
        token: discord.discord.token,
        channelId: discord.discord.channelId,
        maxNotifications: discord.discord.maxNotifications,
        reactionRepository,
        log,
      });
    } else {
      log.info("Discord notifications skipped (DISCORD_CHANNEL_ID not set)");
    }
  } finally {
    await closeBrowserContext();
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  log.error("Fatal error:", error);
  process.exit(1);
});
