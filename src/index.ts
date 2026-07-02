import cron from "node-cron";
import "./config/app.js";
import { buildScrapeFilters, scrapeConfig } from "./config/scrape.js";
import { notificationsConfig } from "./config/notifications.js";
import { createListingRepository } from "./db/listingRepository.js";
import { NotificationPreferenceRepository } from "./db/notificationPreferenceRepository.js";
import { ReactionRepository } from "./db/reactionRepository.js";
import {
  disconnectPrisma,
  ensurePrismaRuntime,
  getPrisma,
} from "./db/prisma.js";
import { createScrapers } from "./scrapers/index.js";
import { formatScrapeErrors } from "./services/formatScrapeSummary.js";
import { notifyScrapeResults } from "./services/notifyScrapeResults.js";
import { scheduleEnrichmentBackfill } from "./services/enrichmentBackfill.js";
import { resetListingCompatibilityCache } from "./services/compatibilityService.js";
import { ScraperService } from "./services/scraperService.js";
import { EnrichmentQueue } from "./services/enrichmentQueue.js";
import { formatVersionLine } from "./version.js";
import { geoFilterLabel, resolveGeoFilter } from "./utils/geo/geoFilter.js";
import {
  closeBrowserContext,
  startBrowserWarmUp,
} from "./utils/browser/client.js";
import { createLogger } from "./utils/logger.js";
import {
  recordDailySnapshot,
  ensureTodaySnapshot,
} from "./services/statsSeriesService.js";

const log = createLogger("app");
const cronLog = createLogger("cron");

async function shutdown(): Promise<void> {
  await closeBrowserContext();
  await disconnectPrisma();
}

async function main(): Promise<void> {
  const scrapers = createScrapers();
  const prisma = getPrisma(scrapeConfig.database.url);
  await ensurePrismaRuntime(prisma);
  const repository = createListingRepository(prisma);
  const reactionRepository = new ReactionRepository(
    prisma,
    resetListingCompatibilityCache
  );
  const notificationPreferenceRepository = new NotificationPreferenceRepository(
    prisma
  );
  const scraperService = new ScraperService(scrapers, repository);
  const enrichmentQueue = new EnrichmentQueue(repository);

  const scrapeOptions = buildScrapeFilters();
  const geoFilter = resolveGeoFilter(scrapeOptions, true);
  const { notifications } = notificationsConfig;

  log.info(`Starting Find My House ${formatVersionLine()}...`);
  log.info(`Database: ${scrapeConfig.database.url}`);
  log.info(
    `Active scrapers: ${scrapers.map((s) => s.name).join(", ") || "none"}`
  );
  log.info(`Search area: ${scrapeOptions.city} (${geoFilterLabel(geoFilter)})`);
  if (notifications.enabled) {
    log.info(
      `Notifications: enabled via ${notifications.notifyServices.join(", ")} (max ${String(notifications.maxNotifications)})`
    );
  }

  startBrowserWarmUp();

  void ensureTodaySnapshot(repository).catch((error: unknown) => {
    log.warn("Failed to ensure stats snapshot:", error);
  });

  if (cron.validate(scrapeConfig.scrape.cron)) {
    cron.schedule(scrapeConfig.scrape.cron, async () => {
      cronLog.info("Scheduled scrape...");
      try {
        const result = await scraperService.run(scrapeOptions);
        enrichmentQueue.scheduleScrapeResults(result);
        cronLog.info(
          `Result: ${String(result.inserted)} new properties, ${String(result.linked)} linked, ${String(result.updated)} updated, ${String(result.skipped)} skipped, ${String(result.deactivated)} deactivated`
        );
        for (const line of formatScrapeErrors(result.errors)) {
          cronLog.warn(line);
        }
        await notifyScrapeResults(result, {
          enabled: notifications.enabled,
          notifyServices: notifications.notifyServices,
          maxNotifications: notifications.maxNotifications,
          repository,
          reactionRepository,
          notificationPreferenceRepository,
          enrichmentQueue,
          log: cronLog,
        });
        await recordDailySnapshot(repository);
      } catch (error) {
        cronLog.error("Scrape error:", error);
      }
    });
    cronLog.info(`Scheduled: ${scrapeConfig.scrape.cron}`);
  } else {
    cronLog.error(
      `Invalid cron expression: "${scrapeConfig.scrape.cron}" — automatic scraping disabled`
    );
  }

  const { enrichment } = scrapeConfig;

  async function runEnrichmentBackfill(
    trigger: "startup" | "cron"
  ): Promise<void> {
    const label =
      trigger === "startup"
        ? "Startup enrichment backfill..."
        : "Scheduled enrichment backfill...";
    cronLog.info(label);
    try {
      const scheduled = await scheduleEnrichmentBackfill(
        repository,
        reactionRepository,
        enrichmentQueue,
        {
          minScore: enrichment.minCompatScore,
          limit: enrichment.batchLimit,
          searchLimit: enrichment.searchLimit,
        }
      );
      cronLog.info(
        `Enrichment backfill: ${String(scheduled)} listing(s) queued`
      );
    } catch (error) {
      cronLog.error("Enrichment backfill error:", error);
    }
  }

  if (enrichment.enabled && cron.validate(enrichment.cron)) {
    cron.schedule(enrichment.cron, () => void runEnrichmentBackfill("cron"));
    cronLog.info(
      `Scheduled enrichment backfill: ${enrichment.cron} (batch ${String(enrichment.batchLimit)}, scan ${String(enrichment.searchLimit)}, min compat ${String(enrichment.minCompatScore)})`
    );
    void runEnrichmentBackfill("startup");
  } else if (enrichment.enabled) {
    cronLog.error(
      `Invalid enrichment cron expression: "${enrichment.cron}" — automatic enrichment backfill disabled`
    );
  }

  const stop = async (signal: string) => {
    log.info(`Shutting down (${signal})...`);
    await shutdown();
    process.exit(0);
  };

  process.on("SIGINT", () => void stop("SIGINT"));
  process.on("SIGTERM", () => void stop("SIGTERM"));

  const { startWebServer } = await import("./api/server.js");
  startWebServer({
    repository,
    reactionRepository,
    notificationPreferenceRepository,
    scraperService,
    enrichmentQueue,
    scrapeDefaults: scrapeOptions,
    notifyScrapeResults: (result) => {
      enrichmentQueue.scheduleScrapeResults(result);
      return notifyScrapeResults(result, {
        enabled: notifications.enabled,
        notifyServices: notifications.notifyServices,
        maxNotifications: notifications.maxNotifications,
        repository,
        reactionRepository,
        notificationPreferenceRepository,
        enrichmentQueue,
        log: cronLog,
      });
    },
  });
}

main().catch(async (error: unknown) => {
  log.error("Fatal error:", error);
  await closeBrowserContext().catch(() => undefined);
  await disconnectPrisma().catch(() => undefined);
  process.exit(1);
});
