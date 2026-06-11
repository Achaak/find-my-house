import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRepository } from "../db/listingRepository.js";
import type { PropertyRow } from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import { buildListingActionComponents } from "./components.js";
import { formatListingEmbed } from "./format.js";

const log = createLogger("discord");

type ListingNotificationOptions = {
  header: (count: number) => string;
  shouldNotify?: (property: PropertyRow) => boolean;
  markNotified?: boolean;
  logLabel: string;
};

async function sendListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  repository: ListingRepository | undefined,
  options: ListingNotificationOptions
): Promise<number> {
  if (listings.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const count = listings.length;
  const header = options.header(count);

  let sent = 0;
  const notifiedIds: number[] = [];
  let headerSent = false;

  for (const listing of listings) {
    const property =
      repository !== undefined
        ? ((await repository.findById(listing.id)) ?? listing)
        : listing;

    if (options.shouldNotify && !options.shouldNotify(property)) continue;

    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: !headerSent ? header : undefined,
          embeds: [formatListingEmbed(property)],
          components: buildListingActionComponents(property.id),
        },
      });
      headerSent = true;
      sent++;
      if (options.markNotified) {
        notifiedIds.push(property.id);
      }
    } catch (error) {
      log.error(
        `Erreur envoi ${options.logLabel} (#${String(listing.id)}):`,
        error
      );
    }
  }

  if (repository && options.markNotified && notifiedIds.length > 0) {
    await repository.markNotified(notifiedIds);
  }

  return sent;
}

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  repository?: ListingRepository
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, repository, {
    header: (count) =>
      count === 1
        ? "🏠 **1 nouvelle annonce**"
        : `🏠 **${String(count)} nouvelles annonces**`,
    markNotified: true,
    logLabel: "notification",
  });
}

export async function sendPriceDropNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  repository?: ListingRepository
): Promise<number> {
  return sendListingNotifications(token, channelId, listings, repository, {
    header: (count) =>
      count === 1
        ? "📉 **1 baisse de prix**"
        : `📉 **${String(count)} baisses de prix**`,
    shouldNotify: (property) => property.price < property.firstPrice,
    markNotified: true,
    logLabel: "baisse de prix",
  });
}
