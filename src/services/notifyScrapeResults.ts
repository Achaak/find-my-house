import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../homeAssistant/notifications.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { NotificationPreferenceRepository } from "../db/notificationPreferenceRepository.js";
import type { PropertyRow } from "../types/listing.js";
import type { CompatibilityModel } from "../types/compatibility.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { buildCompatibilityModel } from "../utils/compatibility/model.js";
import type { Logger } from "../utils/logger.js";
import { ensurePropertyEnriched } from "./enrichmentService.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";

export type NotifyScrapeResultsOptions = {
  notifyService: string;
  enabled?: boolean;
  maxNotifications?: number;
  repository?: ListingRepository;
  reactionRepository?: ReactionRepository;
  notificationPreferenceRepository?: NotificationPreferenceRepository;
  enrichmentQueue?: EnrichmentQueue;
  compatibilityModel?: CompatibilityModel | null;
  log?: Pick<Logger, "info">;
};

export type NotifyScrapeResultsSummary = {
  newListingsSent: number;
  priceDropsSent: number;
};

async function enrichListingsForDisplay(
  repository: ListingRepository,
  listings: PropertyRow[],
  enrichmentQueue?: EnrichmentQueue
): Promise<PropertyRow[]> {
  const enriched: PropertyRow[] = [];

  for (const listing of listings) {
    if (enrichmentQueue) {
      await enrichmentQueue.waitUntilEnriched(listing.id, "display", "high");
      const property = await repository.findById(listing.id);
      enriched.push(property ?? listing);
      continue;
    }

    const { property } = await ensurePropertyEnriched(
      repository,
      listing.id,
      "display"
    );
    enriched.push(property ?? listing);
  }

  return enriched;
}

export async function notifyScrapeResults(
  result: ExtendedScrapeResult,
  options: NotifyScrapeResultsOptions
): Promise<NotifyScrapeResultsSummary> {
  const summary: NotifyScrapeResultsSummary = {
    newListingsSent: 0,
    priceDropsSent: 0,
  };

  if (options.enabled === false) {
    return summary;
  }

  if (options.notificationPreferenceRepository) {
    const shouldSend =
      await options.notificationPreferenceRepository.shouldSendHouseholdNotifications();
    if (!shouldSend) {
      return summary;
    }
  }

  let compatibilityModel = options.compatibilityModel;
  if (compatibilityModel === undefined && options.reactionRepository) {
    const { likes, dislikes } =
      await options.reactionRepository.loadCompatibilityTrainingData();
    compatibilityModel = buildCompatibilityModel(likes, dislikes);
  }

  const limits = {
    maxNotifications: options.maxNotifications,
    compatibilityModel: compatibilityModel ?? null,
  };

  const insertedListings = options.repository
    ? await enrichListingsForDisplay(
        options.repository,
        result.insertedListings,
        options.enrichmentQueue
      )
    : result.insertedListings;
  const priceDropListings = options.repository
    ? await enrichListingsForDisplay(
        options.repository,
        result.priceDropListings,
        options.enrichmentQueue
      )
    : result.priceDropListings;

  if (insertedListings.length > 0) {
    summary.newListingsSent = await sendNewListingNotifications(
      options.notifyService,
      insertedListings,
      limits
    );
    options.log?.info(
      `Home Assistant: ${String(summary.newListingsSent)} new listing(s)`
    );
  }

  if (priceDropListings.length > 0) {
    summary.priceDropsSent = await sendPriceDropNotifications(
      options.notifyService,
      priceDropListings,
      limits
    );
    options.log?.info(
      `Home Assistant: ${String(summary.priceDropsSent)} price drop(s)`
    );
  }

  return summary;
}
