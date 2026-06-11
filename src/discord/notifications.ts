import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRow } from "../types/listing.js";
import { buildListingActionComponents } from "./components.js";
import { formatListingEmbed } from "./format.js";

export async function sendNewListingNotifications(
  token: string,
  channelId: string,
  listings: ListingRow[]
): Promise<number> {
  if (listings.length === 0) return 0;

  const rest = new REST({ version: "10" }).setToken(token);
  const count = listings.length;
  const header =
    count === 1
      ? "🏠 **1 nouvelle annonce**"
      : `🏠 **${String(count)} nouvelles annonces**`;

  let sent = 0;

  for (const [index, listing] of listings.entries()) {
    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: index === 0 ? header : undefined,
          embeds: [formatListingEmbed(listing)],
          components: buildListingActionComponents(listing.id),
        },
      });
      sent++;
    } catch (error) {
      console.error(
        `[discord] Erreur envoi notification (#${String(listing.id)}):`,
        error
      );
    }
  }

  return sent;
}
