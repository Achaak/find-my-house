import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { PropertyRow } from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import { buildListingActionComponents } from "./components.js";
import { formatListingEmbed } from "./format.js";

const log = createLogger("discord");

type ListingNotificationOptions = {
  header: (count: number) => string;
  shouldNotify?: (property: PropertyRow) => boolean;
  logLabel: string;
};

async function sendListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  options: ListingNotificationOptions
): Promise<number> {
  if (listings.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const count = listings.length;
  const header = options.header(count);

  let sent = 0;
  let headerSent = false;

  for (const listing of listings) {
    if (options.shouldNotify && !options.shouldNotify(listing)) continue;

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

  return sent;
}

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[]
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, {
    header: (count) =>
      count === 1
        ? "🏠 **1 nouvelle annonce**"
        : `🏠 **${String(count)} nouvelles annonces**`,
    logLabel: "notification",
  });
}

export async function sendPriceDropNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[]
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, {
    header: (count) =>
      count === 1
        ? "📉 **1 baisse de prix**"
        : `📉 **${String(count)} baisses de prix**`,
    shouldNotify: (property) => property.price < property.firstPrice,
    logLabel: "baisse de prix",
  });
}
