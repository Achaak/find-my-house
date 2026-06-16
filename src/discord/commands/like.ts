import { SlashCommandBuilder } from "discord.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildLikeCommand() {
  return new SlashCommandBuilder()
    .setName("like")
    .setDescription("Manage household favorite listings")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a listing to household favorites")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a listing from household favorites")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show household favorite listings")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Number of results (max 10)")
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("archive")
        .setDescription(
          "Archive a favorite (hidden from list, kept for compatibility score)"
        )
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("unarchive")
        .setDescription("Restore an archived favorite")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    );
}

export const handleLike: CommandHandler = async (interaction, ctx) => {
  const subcommand = interaction.options.getSubcommand();
  await interaction.deferReply();

  if (subcommand === "list") {
    const limit = interaction.options.getInteger("limit") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      "like",
      limit,
      "No household favorites yet."
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
    const result = await ctx.reactionRepository.add(id, "like");
    await interaction.editReply(
      result === "already_exists"
        ? `Listing **#${String(id)}** is already in household favorites.`
        : `❤️ Listing **#${String(id)}** added to household favorites.`
    );
    return;
  }

  if (subcommand === "archive") {
    const result = await ctx.reactionRepository.archive(id);
    await interaction.editReply(
      result === "archived"
        ? `📦 Listing **#${String(id)}** archived. It still counts toward the household compatibility score.`
        : result === "already_archived"
          ? `Listing **#${String(id)}** is already archived.`
          : `Listing **#${String(id)}** is not in household favorites.`
    );
    return;
  }

  if (subcommand === "unarchive") {
    const result = await ctx.reactionRepository.unarchive(id);
    await interaction.editReply(
      result === "unarchived"
        ? `Listing **#${String(id)}** restored to household favorites.`
        : result === "not_archived"
          ? `Listing **#${String(id)}** is not archived.`
          : `Listing **#${String(id)}** is not in household favorites.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(id, "like");
  await interaction.editReply(
    removed
      ? `Listing **#${String(id)}** removed from household favorites.`
      : `Listing **#${String(id)}** was not in household favorites.`
  );
};
