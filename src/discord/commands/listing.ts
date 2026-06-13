import { SlashCommandBuilder } from "discord.js";
import { ensurePropertyEnriched } from "../../services/enrichmentService.js";
import { buildListingActionRow } from "../components.js";
import { formatListingEmbedWithCompatibility } from "../listingEmbed.js";
import type { CommandHandler } from "./types.js";

export function buildListingCommand() {
  return new SlashCommandBuilder()
    .setName("listing")
    .setDescription("Show listing details")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("Listing ID").setRequired(true)
    );
}

export const handleListing: CommandHandler = async (interaction, ctx) => {
  const id = interaction.options.getInteger("id", true);
  await interaction.deferReply();

  const { property: listing } = await ensurePropertyEnriched(
    ctx.repository,
    id,
    "display"
  );

  if (!listing) {
    await interaction.editReply(`Listing #${String(id)} not found.`);
    return;
  }

  await interaction.editReply({
    embeds: [
      await formatListingEmbedWithCompatibility(
        listing,
        ctx.reactionRepository,
        interaction.user.id
      ),
    ],
    components: [buildListingActionRow(listing.id)],
  });
};
