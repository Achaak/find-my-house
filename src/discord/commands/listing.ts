import { SlashCommandBuilder } from "discord.js";
import { ensurePropertyEnriched } from "../../services/enrichmentService.js";
import { buildListingActionRow } from "../components.js";
import { formatListingEmbedWithCompatibility } from "../listingEmbed.js";
import type { CommandHandler } from "./types.js";

export function buildListingCommand() {
  return new SlashCommandBuilder()
    .setName("listing")
    .setDescription("Afficher le détail d'une annonce")
    .addIntegerOption((opt) =>
      opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
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
    await interaction.editReply(`Annonce #${String(id)} introuvable.`);
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
