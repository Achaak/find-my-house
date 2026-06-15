import { SlashCommandBuilder } from "discord.js";
import type { CommandHandler } from "./types.js";

export function buildHelpCommand() {
  return new SlashCommandBuilder()
    .setName("help")
    .setDescription("Show bot help");
}

export const handleHelp: CommandHandler = async (interaction) => {
  await interaction.reply(
    [
      "**Find My House** — Available commands:",
      "",
      "`/listings` — Search the database (city, postal code, text, source, price, surface, land, rooms, bedrooms, old/new build, radius, travel time, sort…)",
      "`/browse` — Browse listings one by one (❤️ / 👎 / Stop), sorted by compatibility",
      "`/listing id:123` — Listing details (❤️ / 👎 buttons)",
      "`/address id:123` — Identify a listing address via ADEME (confirm with button)",
      "`/like add|remove|list|archive|unarchive` — Manage household favorites",
      "`/dislike add|remove|list` — Manage household dislikes",
      "_Click ❤️ or 👎 under a listing to add or remove it._",
      "`/scraper` — Run a scrape (.env criteria, admin)",
      "`/reconcile` — Merge duplicate properties in the database (admin)",
      "`/stats overview|sources|prices|mine|activity` — Database statistics",
      "`/version` — Application version",
      "`/help` — Show this help",
    ].join("\n")
  );
};
