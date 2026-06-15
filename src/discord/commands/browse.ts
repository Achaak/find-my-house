import { MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import {
  buildBrowseReply,
  clearBrowseSession,
  getBrowseSession,
  startBrowseSession,
} from "../browseComponents.js";
import type { CommandHandler } from "./types.js";
import { scrapeFiltersToSearch } from "../../utils/listing/scrapeFilters.js";

export function buildBrowseCommand() {
  return new SlashCommandBuilder()
    .setName("browse")
    .setDescription("Browse listings one by one (❤️ / 👎) until you stop");
}

export const handleBrowse: CommandHandler = async (interaction, ctx) => {
  await interaction.deferReply({
    flags: MessageFlagsBitField.Flags.Ephemeral,
  });

  const discordUserId = interaction.user.id;
  clearBrowseSession(discordUserId);

  const filters = scrapeFiltersToSearch(ctx.defaultScrapeOptions);
  startBrowseSession(discordUserId, filters);
  const session = getBrowseSession(discordUserId);
  if (!session) {
    await interaction.editReply("Unable to start browse session.");
    return;
  }

  const reply = await buildBrowseReply(
    ctx.repository,
    ctx.reactionRepository,
    ctx.enrichmentQueue,
    discordUserId,
    session
  );

  if (reply.embeds.length === 0) {
    await interaction.editReply(reply);
    return;
  }

  await interaction.editReply(reply);
};
