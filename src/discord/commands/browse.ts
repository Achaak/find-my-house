import { MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import type {
  ListingSearchFilters,
  ScrapeFilters,
} from "../../types/listing.js";
import {
  buildBrowseReply,
  clearBrowseSession,
  getBrowseSession,
  startBrowseSession,
} from "../browseComponents.js";
import type { CommandHandler } from "./types.js";

function scrapeFiltersToSearch(filters: ScrapeFilters): ListingSearchFilters {
  return {
    city: filters.city,
    maxPrice: filters.maxPrice,
    minSurface: filters.minSurface,
    minLandSurface: filters.minLandSurface,
    minRooms: filters.minRooms,
    minBedrooms: filters.minBedrooms,
    ancienOnly: filters.ancienOnly,
    maxTravelMinutes: filters.maxTravelMinutes,
  };
}

export function buildBrowseCommand() {
  return new SlashCommandBuilder()
    .setName("browse")
    .setDescription(
      "Parcourir les annonces une par une (❤️ / 👎) jusqu'à arrêter"
    );
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
    await interaction.editReply("Impossible de démarrer le parcours.");
    return;
  }

  const reply = await buildBrowseReply(
    ctx.repository,
    ctx.reactionRepository,
    discordUserId,
    session
  );

  if (reply.embeds.length === 0) {
    await interaction.editReply(reply);
    return;
  }

  await interaction.editReply(reply);
};
