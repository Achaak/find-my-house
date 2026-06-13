import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../discord/notifications.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { PropertyRow } from "../types/listing.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { learnCompatibilityPreferences } from "../utils/compatibility/learn.js";
import type { Logger } from "../utils/logger.js";
import { ensurePropertyEnriched } from "./enrichmentService.js";

export type NotifyScrapeResultsOptions = {
  token: string;
  channelId?: string;
  maxNotifications?: number;
  repository?: ListingRepository;
  reactionRepository?: ReactionRepository;
  compatibilityPreferences?: CompatibilityPreferences;
  log?: Pick<Logger, "info">;
};

export type NotifyScrapeResultsSummary = {
  newListingsSent: number;
  priceDropsSent: number;
};

async function enrichListingsForDisplay(
  repository: ListingRepository,
  listings: PropertyRow[]
): Promise<PropertyRow[]> {
  const enriched: PropertyRow[] = [];

  for (const listing of listings) {
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

  const insertedListings = options.repository
    ? await enrichListingsForDisplay(
        options.repository,
        result.insertedListings
      )
    : result.insertedListings;
  const priceDropListings = options.repository
    ? await enrichListingsForDisplay(
        options.repository,
        result.priceDropListings
      )
    : result.priceDropListings;

  if (insertedListings.length > 0) {
    summary.newListingsSent = await sendNewListingNotifications(
      options.token,
      options.channelId,
      insertedListings,
      limits
    );
    options.log?.info(
      `Discord: ${String(summary.newListingsSent)} new listing(s)`
    );
  }

  if (priceDropListings.length > 0) {
    summary.priceDropsSent = await sendPriceDropNotifications(
      options.token,
      options.channelId,
      priceDropListings,
      limits
    );
    options.log?.info(
      `Discord: ${String(summary.priceDropsSent)} price drop(s)`
    );
  }

  return summary;
}
