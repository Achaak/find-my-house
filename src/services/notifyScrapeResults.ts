import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../discord/notifications.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { learnCompatibilityPreferences } from "../utils/compatibility/learn.js";
import type { Logger } from "../utils/logger.js";

export type NotifyScrapeResultsOptions = {
  token: string;
  channelId?: string;
  maxNotifications?: number;
  reactionRepository?: ReactionRepository;
  compatibilityPreferences?: CompatibilityPreferences;
  log?: Pick<Logger, "info">;
};

export type NotifyScrapeResultsSummary = {
  newListingsSent: number;
  priceDropsSent: number;
};

export async function notifyScrapeResults(
  result: ExtendedScrapeResult,
  options: NotifyScrapeResultsOptions
): Promise<NotifyScrapeResultsSummary> {
  const summary: NotifyScrapeResultsSummary = {
    newListingsSent: 0,
    priceDropsSent: 0,
  };

  if (!options.channelId) {
    return summary;
  }

  let compatibilityPreferences = options.compatibilityPreferences;
  if (!compatibilityPreferences && options.reactionRepository) {
    const { likes, dislikes } =
      await options.reactionRepository.loadCompatibilityTrainingData();
    compatibilityPreferences =
      learnCompatibilityPreferences(likes, dislikes) ?? undefined;
  }

  const limits = {
    maxNotifications: options.maxNotifications,
    compatibilityPreferences,
  };

  if (result.insertedListings.length > 0) {
    summary.newListingsSent = await sendNewListingNotifications(
      options.token,
      options.channelId,
      result.insertedListings,
      limits
    );
    options.log?.info(
      `Discord: ${String(summary.newListingsSent)} nouvelle(s) annonce(s)`
    );
  }

  if (result.priceDropListings.length > 0) {
    summary.priceDropsSent = await sendPriceDropNotifications(
      options.token,
      options.channelId,
      result.priceDropListings,
      limits
    );
    options.log?.info(
      `Discord: ${String(summary.priceDropsSent)} baisse(s) de prix`
    );
  }

  return summary;
}
