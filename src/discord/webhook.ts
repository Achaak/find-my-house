import { formatListingEmbed } from "./format.js";
import type { ListingRow } from "../types/listing.js";

export async function sendNewListingNotifications(
  webhookUrl: string,
  listings: ListingRow[]
): Promise<void> {
  if (listings.length === 0) return;

  const count = listings.length;
  const header =
    count === 1
      ? "🏠 **1 nouvelle annonce**"
      : `🏠 **${count} nouvelles annonces**`;

  for (let i = 0; i < listings.length; i += 10) {
    const batch = listings.slice(i, i + 10);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: i === 0 ? header : undefined,
        embeds: batch.map(formatListingEmbed),
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[discord] Webhook erreur ${response.status}: ${body}`);
    }
  }
}
