import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
  MessageFlagsBitField,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type {
  ReactionRepository,
  ReactionType,
} from "../db/reactionRepository.js";
import { resetListingCompatibilityCache } from "./listingEmbed.js";

const LIKE_PREFIX = "listing:like:";
const DISLIKE_PREFIX = "listing:dislike:";

export function buildListingActionRow(listingId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${LIKE_PREFIX}${String(listingId)}`)
      .setLabel("Like")
      .setEmoji("❤️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${DISLIKE_PREFIX}${String(listingId)}`)
      .setLabel("Dislike")
      .setEmoji("👎")
      .setStyle(ButtonStyle.Danger)
  );
}

export function buildListingActionComponents(listingId: number) {
  return [buildListingActionRow(listingId).toJSON()];
}

function parseListingButtonCustomId(
  customId: string
): { listingId: number; type: ReactionType } | null {
  if (customId.startsWith(LIKE_PREFIX)) {
    const listingId = Number(customId.slice(LIKE_PREFIX.length));
    return Number.isInteger(listingId) && listingId > 0
      ? { listingId, type: "like" }
      : null;
  }

  if (customId.startsWith(DISLIKE_PREFIX)) {
    const listingId = Number(customId.slice(DISLIKE_PREFIX.length));
    return Number.isInteger(listingId) && listingId > 0
      ? { listingId, type: "dislike" }
      : null;
  }

  return null;
}

const toggleMessages: Record<
  ReactionType,
  Record<"added" | "removed", string>
> = {
  like: {
    added: "❤️ Added to your favorites.",
    removed: "Removed from your favorites.",
  },
  dislike: {
    added: "👎 Added to your dislikes.",
    removed: "Removed from your dislikes.",
  },
};

export async function handleListingButton(
  interaction: ButtonInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository
): Promise<boolean> {
  const parsed = parseListingButtonCustomId(interaction.customId);
  if (!parsed) return false;

  await interaction.deferReply({
    flags: MessageFlagsBitField.Flags.Ephemeral,
  });

  const listing = await repository.findById(parsed.listingId);
  if (!listing) {
    await interaction.editReply(
      `Listing #${String(parsed.listingId)} not found.`
    );
    return true;
  }

  const result = await reactionRepository.toggle(parsed.listingId, parsed.type);
  resetListingCompatibilityCache();

  await interaction.editReply(toggleMessages[parsed.type][result]);
  return true;
}
