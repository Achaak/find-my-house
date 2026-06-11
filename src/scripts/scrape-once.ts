import { config } from "../config.js";
import { ListingRepository } from "../db/listingRepository.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { sendNewListingNotifications } from "../discord/notifications.js";
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
    console.log(`  Trouvées:   ${result.found}`);
    console.log(`  Nouvelles:  ${result.inserted}`);
    console.log(`  MAJ:        ${result.updated}`);
    console.log(`  Ignorées:   ${result.skipped}`);
    console.log(`  Total BDD:  ${await repository.count()}`);

    if (config.discord.channelId && result.insertedListings.length > 0) {
      const sent = await sendNewListingNotifications(
        config.discord.token,
        config.discord.channelId,
        result.insertedListings
      );
      console.log(`  Discord:    ${sent} notification(s) envoyée(s)`);
    }
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
