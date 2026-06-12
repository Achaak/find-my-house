import { SlashCommandBuilder } from "discord.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildPasJaimeCommand() {
  return new SlashCommandBuilder()
    .setName("pas-jaime")
    .setDescription("Gérer les annonces que vous n'aimez pas")
    .addSubcommand((sub) =>
      sub
        .setName("ajouter")
        .setDescription("Marquer une annonce comme non aimée")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("retirer")
        .setDescription("Retirer une annonce de vos non-favoris")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("liste")
        .setDescription("Afficher les annonces que vous n'aimez pas")
        .addIntegerOption((opt) =>
          opt
            .setName("limite")
            .setDescription("Nombre de résultats (max 10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    );
}

export const handlePasJaime: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  const discordUserId = interaction.user.id;
  await interaction.deferReply();

  if (subcommand === "liste") {
    const limit = interaction.options.getInteger("limite") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      discordUserId,
      "dislike",
      limit,
      "Vous n'avez marqué aucune annonce comme non aimée."
    );
    await interaction.editReply(reply);
    return;
  }

  const id = interaction.options.getInteger("id", true);
  const listing = await ctx.repository.findById(id);

  if (!listing) {
    await interaction.editReply(`Annonce #${String(id)} introuvable.`);
    return;
  }

  if (subcommand === "ajouter") {
    const result = await ctx.reactionRepository.add(
      discordUserId,
      id,
      "dislike"
    );
    await interaction.editReply(
      result === "already_exists"
        ? `L'annonce **#${String(id)}** est déjà dans vos non-favoris.`
        : `👎 Annonce **#${String(id)}** ajoutée à vos non-favoris.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(
    discordUserId,
    id,
    "dislike"
  );
  await interaction.editReply(
    removed
      ? `Annonce **#${String(id)}** retirée de vos non-favoris.`
      : `L'annonce **#${String(id)}** n'était pas dans vos non-favoris.`
  );
};
