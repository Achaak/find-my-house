import type { ReactionRepository } from "../../db/reactionRepository.js";
import { formatListingEmbed } from "../format.js";

export type ReactionListReply = {
  content: string;
  embeds: ReturnType<typeof formatListingEmbed>[];
};

export async function formatReactionList(
  reactionRepository: ReactionRepository,
  discordUserId: string,
  type: "like" | "dislike",
  limit: number,
  emptyLabel: string
): Promise<ReactionListReply> {
  const total = await reactionRepository.countByUser(discordUserId, type);
  const listings = await reactionRepository.findListingsByUser(
    discordUserId,
    type,
    limit
  );

  if (listings.length === 0) {
    return { content: emptyLabel, embeds: [] };
  }

  const header =
    total > limit
      ? `**${String(total)}** au total — ${String(listings.length)} affichées :`
      : `**${String(total)}** annonce${total > 1 ? "s" : ""} :`;

  return {
    content: header,
    embeds: listings.map(formatListingEmbed),
  };
}
