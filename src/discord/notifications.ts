import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/rest/v10";
import type { ListingRow } from "../types/listing.js";
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

  for (let i = 0; i < listings.length; i += 10) {
    const batch = listings.slice(i, i + 10);
    try {
      await rest.post(Routes.channelMessages(channelId), {
        body: {
          content: i === 0 ? header : undefined,
          embeds: batch.map(formatListingEmbed),
        },
      });
      sent += batch.length;
    } catch (error) {
      console.error(
        `[discord] Erreur envoi notification (lot ${String(Math.floor(i / 10) + 1)}):`,
        error
      );
    }
  }

  return sent;
}
