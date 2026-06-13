import { SlashCommandBuilder } from "discord.js";
import { resetListingCompatibilityCache } from "../listingEmbed.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildDislikeCommand() {
  return new SlashCommandBuilder()
    .setName("dislike")
    .setDescription("Manage listings you dislike")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Mark a listing as disliked")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a listing from your dislikes")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show listings you have disliked")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Number of results (max 10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    );
}

export const handleDislike: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  const discordUserId = interaction.user.id;
  await interaction.deferReply();

  if (subcommand === "list") {
    const limit = interaction.options.getInteger("limit") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      discordUserId,
      "dislike",
      limit,
      "You have not marked any listings as disliked."
    );
    await interaction.editReply(reply);
    return;
  }

  const id = interaction.options.getInteger("id", true);
  const listing = await ctx.repository.findById(id);

  if (!listing) {
    await interaction.editReply(`Listing #${String(id)} not found.`);
    return;
  }

  if (subcommand === "add") {
    const result = await ctx.reactionRepository.add(
      discordUserId,
      id,
      "dislike"
    );
    resetListingCompatibilityCache();
    await interaction.editReply(
      result === "already_exists"
        ? `Listing **#${String(id)}** is already in your dislikes.`
        : `👎 Listing **#${String(id)}** added to your dislikes.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(
    discordUserId,
    id,
    "dislike"
  );
  resetListingCompatibilityCache();
  await interaction.editReply(
    removed
      ? `Listing **#${String(id)}** removed from your dislikes.`
      : `Listing **#${String(id)}** was not in your dislikes.`
  );
};
