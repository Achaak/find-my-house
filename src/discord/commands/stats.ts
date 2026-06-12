import { SlashCommandBuilder } from "discord.js";
import { formatRecentListingsEmbed } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildStatsCommand() {
  return new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Statistiques de la base d'annonces");
}

export const handleStats: CommandHandler = async (interaction, ctx) => {
  await interaction.deferReply();

  const total = await ctx.repository.count();
  const publications = await ctx.repository.countPublications();
  const recent = await ctx.repository.findRecent(3);

  await interaction.editReply({
    embeds: [formatRecentListingsEmbed(total, publications, recent)],
  });
};
