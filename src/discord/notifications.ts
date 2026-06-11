import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRepository } from "../db/listingRepository.js";
import type { PropertyRow } from "../types/listing.js";
import { buildListingActionComponents } from "./components.js";
import { formatListingEmbed } from "./format.js";

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  repository?: ListingRepository
): Promise<number> {
  if (listings.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const count = listings.length;
  const header =
    count === 1
      ? "🏠 **1 nouvelle annonce**"
      : `🏠 **${String(count)} nouvelles annonces**`;

  let sent = 0;
  const notifiedIds: number[] = [];

  for (const [index, listing] of listings.entries()) {
    const property =
      repository !== undefined
        ? ((await repository.findById(listing.id)) ?? listing)
        : listing;

    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: index === 0 ? header : undefined,
          embeds: [formatListingEmbed(property)],
          components: buildListingActionComponents(property.id),
        },
      });
      sent++;
      notifiedIds.push(property.id);
    } catch (error) {
      console.error(
        `[discord] Erreur envoi notification (#${String(listing.id)}):`,
        error
      );
    }
  }

  if (repository && notifiedIds.length > 0) {
    await repository.markNotified(notifiedIds);
  }

  return sent;
}

export async function sendPriceDropNotifications(
  token: string,
  channelId: string,
  listings: PropertyRow[],
  repository?: ListingRepository
): Promise<number> {
  if (listings.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const count = listings.length;
  const header =
    count === 1
      ? "📉 **1 baisse de prix**"
      : `📉 **${String(count)} baisses de prix**`;

  let sent = 0;

  for (const [index, listing] of listings.entries()) {
    const property =
      repository !== undefined
        ? ((await repository.findById(listing.id)) ?? listing)
        : listing;

    if (property.price >= property.firstPrice) continue;

    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: index === 0 ? header : undefined,
          embeds: [formatListingEmbed(property)],
          components: buildListingActionComponents(property.id),
        },
      });
      sent++;
    } catch (error) {
      console.error(
        `[discord] Erreur envoi baisse de prix (#${String(listing.id)}):`,
        error
      );
    }
  }

  return sent;
}
