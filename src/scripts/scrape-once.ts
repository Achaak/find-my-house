import { config } from "../config.js";
import { ListingRepository } from "../db/listingRepository.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { sendNewListingNotifications } from "../discord/webhook.js";
import { BrowserManager, createScrapers } from "../scrapers/index.js";
import { ScraperService } from "../services/scraperService.js";

async function main(): Promise<void> {
  const prisma = getPrisma(config.database.url);
  const repository = new ListingRepository(prisma);
  const browser = new BrowserManager();
  const scraperService = new ScraperService(createScrapers(browser), repository);

  try {
    const result = await scraperService.run({
      city: config.scrape.city,
      maxPrice: config.scrape.maxPrice,
      minSurface: config.scrape.minSurface,
    });

    console.log("Résultat du scraping:");
    console.log(`  Trouvées:   ${result.found}`);
    console.log(`  Nouvelles:  ${result.inserted}`);
    console.log(`  MAJ:        ${result.updated}`);
    console.log(`  Ignorées:   ${result.skipped}`);
    console.log(`  Total BDD:  ${await repository.count()}`);

    if (config.discord.webhookUrl && result.insertedListings.length > 0) {
      await sendNewListingNotifications(
        config.discord.webhookUrl,
        result.insertedListings
      );
      console.log(`  Discord:    ${result.insertedListings.length} notification(s) envoyée(s)`);
    }
  } finally {
    await browser.close();
    await disconnectPrisma();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
