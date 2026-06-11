import { buildScrapeFilters, config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("scrape-once");
import { ListingRepository } from "../db/listingRepository.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../discord/notifications.js";
import { createScrapers } from "../scrapers/index.js";
import { ScraperService } from "../services/scraperService.js";

async function main(): Promise<void> {
  const prisma = getPrisma(config.database.url);
  const repository = new ListingRepository(prisma);
  const scraperService = new ScraperService(createScrapers(), repository);

  try {
    const result = await scraperService.run(buildScrapeFilters());

    log.info("Résultat du scraping:");
    log.info(`  Trouvées:   ${String(result.found)}`);
    log.info(`  Nouveaux:   ${String(result.inserted)}`);
    log.info(`  Liées:      ${String(result.linked)}`);
    log.info(`  MAJ:        ${String(result.updated)}`);
    log.info(`  Baisses:    ${String(result.priceDropListings.length)}`);
    log.info(`  Ignorées:   ${String(result.skipped)}`);
    log.info(`  Total BDD:  ${String(await repository.count())} biens`);

    if (config.discord.channelId) {
      if (result.insertedListings.length > 0) {
        const sent = await sendNewListingNotifications(
          config.discord.token,
          config.discord.channelId,
          result.insertedListings,
          repository
        );
        log.info(`  Discord:    ${String(sent)} nouvelle(s) annonce(s)`);
      }
      if (result.priceDropListings.length > 0) {
        const sent = await sendPriceDropNotifications(
          config.discord.token,
          config.discord.channelId,
          result.priceDropListings,
          repository
        );
        log.info(`  Discord:    ${String(sent)} baisse(s) de prix`);
      }
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
