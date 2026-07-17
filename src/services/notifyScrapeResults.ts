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
import type { EnrichmentQueue } from "./enrichmentQueue.js";

export type NotifyScrapeResultsOptions = {
  notifyServices: string[];
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
  listings: PropertyRow[],
  enrichmentQueue: EnrichmentQueue
): Promise<PropertyRow[]> {
  const enriched: PropertyRow[] = [];

  for (const listing of listings) {
    const property = await enrichmentQueue.ensureReady(
      listing.id,
      "display",
      "high"
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

  const insertedListings = options.enrichmentQueue
    ? await enrichListingsForDisplay(
        result.insertedListings,
        options.enrichmentQueue
      )
    : result.insertedListings;
  const priceDropListings = options.enrichmentQueue
    ? await enrichListingsForDisplay(
        result.priceDropListings,
        options.enrichmentQueue
      )
    : result.priceDropListings;

  if (insertedListings.length > 0) {
    summary.newListingsSent = await sendNewListingNotifications(
      options.notifyServices,
      insertedListings,
      limits
    );
    options.log?.info(
      `Home Assistant: ${String(summary.newListingsSent)} new listing(s)`
    );
  }

  if (priceDropListings.length > 0) {
    summary.priceDropsSent = await sendPriceDropNotifications(
      options.notifyServices,
      priceDropListings,
      limits
    );
    options.log?.info(
      `Home Assistant: ${String(summary.priceDropsSent)} price drop(s)`
    );
  }

  return summary;
}
