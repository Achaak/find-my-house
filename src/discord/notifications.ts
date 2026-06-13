import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import {
  scorePropertyCompatibility,
  sortByCompatibility,
} from "../utils/compatibility/score.js";
import { createLogger } from "../utils/logger.js";
import { buildListingActionComponents } from "./components.js";
import { formatListingEmbed } from "./format.js";

const log = createLogger("discord");

type ListingNotificationOptions = {
  header: (total: number, shown: number) => string;
  overflow: (hidden: number) => string;
  shouldNotify?: (property: PropertyRow) => boolean;
  logLabel: string;
  maxNotifications?: number;
  compatibilityPreferences?: CompatibilityPreferences;
};

async function sendListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  options: ListingNotificationOptions
): Promise<number> {
  const { shouldNotify, compatibilityPreferences } = options;
  const eligible = shouldNotify
    ? listings.filter((listing) => shouldNotify(listing))
    : listings;
  if (eligible.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const maxNotifications = options.maxNotifications ?? eligible.length;
  const ranked = compatibilityPreferences
    ? sortByCompatibility(eligible, compatibilityPreferences)
    : eligible;
  const toNotify = ranked.slice(0, maxNotifications);
  const hidden = eligible.length - toNotify.length;
  const header = options.header(eligible.length, toNotify.length);

  let sent = 0;
  let headerSent = false;

  for (const listing of toNotify) {
    try {
      const compatibilityScore = compatibilityPreferences
        ? scorePropertyCompatibility(listing, compatibilityPreferences)?.score
        : undefined;

      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: !headerSent ? header : undefined,
          embeds: [formatListingEmbed(listing, { compatibilityScore })],
          components: buildListingActionComponents(listing.id),
        },
      });
      headerSent = true;
      sent++;
    } catch (error) {
      log.error(
        `Send error ${options.logLabel} (#${String(listing.id)}):`,
        error
      );
    }
  }

  if (hidden > 0) {
    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: options.overflow(hidden),
        },
      });
    } catch (error) {
      log.error(`Summary send error ${options.logLabel}:`, error);
    }
  }

  return sent;
}

export type ListingNotificationLimits = {
  maxNotifications?: number;
  compatibilityPreferences?: CompatibilityPreferences;
};

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, {
    header: (total, shown) => {
      if (total === 1) return "🏠 **1 new listing**";
      if (total === shown) {
        return `🏠 **${String(total)} new listings**`;
      }
      return `🏠 **${String(total)} new listings** — showing first ${String(shown)}`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ **1 other listing** not shown — use `/listings` to view it."
        : `⏭️ **${String(hidden)} other listings** not shown — use \`/listings\` to view them.`,
    logLabel: "notification",
    maxNotifications: limits.maxNotifications,
    compatibilityPreferences: limits.compatibilityPreferences,
  });
}

export async function sendPriceDropNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, {
    header: (total, shown) => {
      if (total === 1) return "📉 **1 price drop**";
      if (total === shown) {
        return `📉 **${String(total)} price drops**`;
      }
      return `📉 **${String(total)} price drops** — showing first ${String(shown)}`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ **1 other price drop** not shown — use `/listings` to view it."
        : `⏭️ **${String(hidden)} other price drops** not shown — use \`/listings\` to view them.`,
    shouldNotify: (property) => property.price < property.firstPrice,
    logLabel: "price drop",
    maxNotifications: limits.maxNotifications,
    compatibilityPreferences: limits.compatibilityPreferences,
  });
}
