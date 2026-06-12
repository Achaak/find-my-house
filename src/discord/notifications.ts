import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { PropertyRow } from "../types/listing.js";
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
};

async function sendListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  options: ListingNotificationOptions
): Promise<number> {
  const { shouldNotify } = options;
  const eligible = shouldNotify
    ? listings.filter((listing) => shouldNotify(listing))
    : listings;
  if (eligible.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const maxNotifications = options.maxNotifications ?? eligible.length;
  const toNotify = eligible.slice(0, maxNotifications);
  const hidden = eligible.length - toNotify.length;
  const header = options.header(eligible.length, toNotify.length);

  let sent = 0;
  let headerSent = false;

  for (const listing of toNotify) {
    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: !headerSent ? header : undefined,
          embeds: [formatListingEmbed(listing)],
          components: buildListingActionComponents(listing.id),
        },
      });
      headerSent = true;
      sent++;
    } catch (error) {
      log.error(
        `Erreur envoi ${options.logLabel} (#${String(listing.id)}):`,
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
      log.error(`Erreur envoi résumé ${options.logLabel}:`, error);
    }
  }

  return sent;
}

export type ListingNotificationLimits = {
  maxNotifications?: number;
};

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  limits: ListingNotificationLimits = {}
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, {
    header: (total, shown) => {
      if (total === 1) return "🏠 **1 nouvelle annonce**";
      if (total === shown) {
        return `🏠 **${String(total)} nouvelles annonces**`;
      }
      return `🏠 **${String(total)} nouvelles annonces** — affichage des ${String(shown)} premières`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ **1 autre annonce** non affichée — utilisez `/listings` pour la consulter."
        : `⏭️ **${String(hidden)} autres annonces** non affichées — utilisez \`/listings\` pour les consulter.`,
    logLabel: "notification",
    maxNotifications: limits.maxNotifications,
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
      if (total === 1) return "📉 **1 baisse de prix**";
      if (total === shown) {
        return `📉 **${String(total)} baisses de prix**`;
      }
      return `📉 **${String(total)} baisses de prix** — affichage des ${String(shown)} premières`;
    },
    overflow: (hidden) =>
      hidden === 1
        ? "⏭️ **1 autre baisse de prix** non affichée — utilisez `/listings` pour la consulter."
        : `⏭️ **${String(hidden)} autres baisses de prix** non affichées — utilisez \`/listings\` pour les consulter.`,
    shouldNotify: (property) => property.price < property.firstPrice,
    logLabel: "baisse de prix",
    maxNotifications: limits.maxNotifications,
  });
}
