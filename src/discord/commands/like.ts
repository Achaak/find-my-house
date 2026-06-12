import { SlashCommandBuilder } from "discord.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildLikeCommand() {
  return new SlashCommandBuilder()
    .setName("like")
    .setDescription("Gérer vos annonces favorites")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Ajouter une annonce à vos favoris")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Retirer une annonce de vos favoris")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID de l'annonce").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Afficher vos annonces favorites")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Nombre de résultats (max 10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    );
}

export const handleLike: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  const discordUserId = interaction.user.id;
  await interaction.deferReply();

  if (subcommand === "list") {
    const limit = interaction.options.getInteger("limit") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      discordUserId,
      "like",
      limit,
      "Vous n'avez aucune annonce en favori."
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

  if (subcommand === "add") {
    const result = await ctx.reactionRepository.add(discordUserId, id, "like");
    await interaction.editReply(
      result === "already_exists"
        ? `L'annonce **#${String(id)}** est déjà dans vos favoris.`
        : `❤️ Annonce **#${String(id)}** ajoutée à vos favoris.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(
    discordUserId,
    id,
    "like"
  );
  await interaction.editReply(
    removed
      ? `Annonce **#${String(id)}** retirée de vos favoris.`
      : `L'annonce **#${String(id)}** n'était pas dans vos favoris.`
  );
};
