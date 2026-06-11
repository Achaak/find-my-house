import { config } from "../config.js";
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
    const result = await scraperService.run({
      city: config.scrape.city,
      maxPrice: config.scrape.maxPrice,
      minSurface: config.scrape.minSurface,
      minLandSurface: config.scrape.minLandSurface,
      minRooms: config.scrape.minRooms,
      minBedrooms: config.scrape.minBedrooms,
      ancienOnly: config.scrape.ancienOnly,
      radiusKm: config.scrape.radiusKm,
      maxTravelMinutes: config.scrape.maxTravelMinutes,
    });

    console.log("Résultat du scraping:");
    console.log(`  Trouvées:   ${String(result.found)}`);
    console.log(`  Nouveaux:   ${String(result.inserted)}`);
    console.log(`  Liées:      ${String(result.linked)}`);
    console.log(`  MAJ:        ${String(result.updated)}`);
    console.log(`  Baisses:    ${String(result.priceDropListings.length)}`);
    console.log(`  Ignorées:   ${String(result.skipped)}`);
    console.log(`  Total BDD:  ${String(await repository.count())} biens`);

    if (config.discord.channelId) {
      if (result.insertedListings.length > 0) {
        const sent = await sendNewListingNotifications(
          config.discord.token,
          config.discord.channelId,
          result.insertedListings,
          repository
        );
        console.log(`  Discord:    ${String(sent)} nouvelle(s) annonce(s)`);
      }
      if (result.priceDropListings.length > 0) {
        const sent = await sendPriceDropNotifications(
          config.discord.token,
          config.discord.channelId,
          result.priceDropListings,
          repository
        );
        console.log(`  Discord:    ${String(sent)} baisse(s) de prix`);
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
