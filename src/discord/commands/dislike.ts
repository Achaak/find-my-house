import { SlashCommandBuilder } from "discord.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildDislikeCommand() {
  return new SlashCommandBuilder()
    .setName("dislike")
    .setDescription("Manage household disliked listings")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Mark a listing as a household dislike")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a listing from household dislikes")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show household disliked listings")
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
  await interaction.deferReply();

  if (subcommand === "list") {
    const limit = interaction.options.getInteger("limit") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      "dislike",
      limit,
      "No household dislikes yet."
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
    const result = await ctx.reactionRepository.add(id, "dislike");
    await interaction.editReply(
      result === "already_exists"
        ? `Listing **#${String(id)}** is already in household dislikes.`
        : `👎 Listing **#${String(id)}** added to household dislikes.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(id, "dislike");
  await interaction.editReply(
    removed
      ? `Listing **#${String(id)}** removed from household dislikes.`
      : `Listing **#${String(id)}** was not in household dislikes.`
  );
};
