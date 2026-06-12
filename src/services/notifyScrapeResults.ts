import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../discord/notifications.js";
import type { ExtendedScrapeResult } from "../types/listing.js";
import type { Logger } from "../utils/logger.js";

export type NotifyScrapeResultsOptions = {
  token: string;
  channelId?: string;
  maxNotifications?: number;
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

  const limits = { maxNotifications: options.maxNotifications };

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
