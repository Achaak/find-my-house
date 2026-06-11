import { MessageFlags } from "discord-api-types/v10";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ButtonInteraction,
} from "discord.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type {
  ReactionRepository,
  ReactionType,
} from "../db/reactionRepository.js";

const LIKE_PREFIX = "listing:like:";
const DISLIKE_PREFIX = "listing:dislike:";

export function buildListingActionRow(listingId: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${LIKE_PREFIX}${String(listingId)}`)
      .setLabel("J'aime")
      .setEmoji("❤️")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${DISLIKE_PREFIX}${String(listingId)}`)
      .setLabel("Pas j'aime")
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
    added: "❤️ Ajouté à vos favoris.",
    removed: "Retiré de vos favoris.",
  },
  dislike: {
    added: "👎 Ajouté à vos non-favoris.",
    removed: "Retiré de vos non-favoris.",
  },
};

export async function handleListingButton(
  interaction: ButtonInteraction,
  repository: ListingRepository,
  reactionRepository: ReactionRepository
): Promise<void> {
  const parsed = parseListingButtonCustomId(interaction.customId);
  if (!parsed) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const listing = await repository.findById(parsed.listingId);
  if (!listing) {
    await interaction.editReply(
      `Annonce #${String(parsed.listingId)} introuvable.`
    );
    return;
  }

  const result = await reactionRepository.toggle(
    interaction.user.id,
    parsed.listingId,
    parsed.type
  );

  await interaction.editReply(toggleMessages[parsed.type][result]);
}
