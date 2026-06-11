import { SlashCommandBuilder } from "discord.js";
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

  const lines = [
    `📊 **${String(total)}** biens — **${String(publications)}** publications`,
    "",
    "**Derniers biens:**",
    recent.length > 0
      ? recent
          .map((l) => {
            const sources = [
              ...new Set(l.publications.map((p) => p.source)),
            ].join(", ");
            return `• #${String(l.id)} — ${l.title} (${l.city}) [${sources}]`;
          })
          .join("\n")
      : "_Aucune annonce pour le moment_",
  ];

  await interaction.editReply(lines.join("\n"));
};
