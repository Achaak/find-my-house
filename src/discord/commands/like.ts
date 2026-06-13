import { SlashCommandBuilder } from "discord.js";
import { resetListingCompatibilityCache } from "../listingEmbed.js";
import { formatReactionList } from "./reactions.js";
import type { CommandHandler } from "./types.js";

export function buildLikeCommand() {
  return new SlashCommandBuilder()
    .setName("like")
    .setDescription("Manage your favorite listings")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Add a listing to your favorites")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Remove a listing from your favorites")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("Listing ID").setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Show your favorite listings")
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
  const discordUserId = interaction.user.id;
  await interaction.deferReply();

  if (subcommand === "list") {
    const limit = interaction.options.getInteger("limit") ?? 5;
    const reply = await formatReactionList(
      ctx.reactionRepository,
      discordUserId,
      "like",
      limit,
      "You have no favorited listings."
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
    const result = await ctx.reactionRepository.add(discordUserId, id, "like");
    resetListingCompatibilityCache();
    await interaction.editReply(
      result === "already_exists"
        ? `Listing **#${String(id)}** is already in your favorites.`
        : `❤️ Listing **#${String(id)}** added to your favorites.`
    );
    return;
  }

  if (subcommand === "archive") {
    const result = await ctx.reactionRepository.archive(discordUserId, id);
    await interaction.editReply(
      result === "archived"
        ? `📦 Listing **#${String(id)}** archived. It still counts toward your compatibility score.`
        : result === "already_archived"
          ? `Listing **#${String(id)}** is already archived.`
          : `Listing **#${String(id)}** is not in your favorites.`
    );
    return;
  }

  if (subcommand === "unarchive") {
    const result = await ctx.reactionRepository.unarchive(discordUserId, id);
    await interaction.editReply(
      result === "unarchived"
        ? `Listing **#${String(id)}** restored to your favorites.`
        : result === "not_archived"
          ? `Listing **#${String(id)}** is not archived.`
          : `Listing **#${String(id)}** is not in your favorites.`
    );
    return;
  }

  const removed = await ctx.reactionRepository.remove(
    discordUserId,
    id,
    "like"
  );
  resetListingCompatibilityCache();
  await interaction.editReply(
    removed
      ? `Listing **#${String(id)}** removed from your favorites.`
      : `Listing **#${String(id)}** was not in your favorites.`
  );
};
