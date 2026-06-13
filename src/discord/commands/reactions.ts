import type { ReactionRepository } from "../../db/reactionRepository.js";
import type { ListingEmbed } from "../format.js";
import { formatListingEmbedsWithCompatibility } from "../listingEmbed.js";

export type ReactionListReply = {
  content: string;
  embeds: ListingEmbed[];
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
      ? `**${String(total)}** total — showing ${String(listings.length)}:`
      : `**${String(total)}** listing${total > 1 ? "s" : ""}:`;

  return {
    content: header,
    embeds: await formatListingEmbedsWithCompatibility(
      listings,
      reactionRepository,
      discordUserId
    ),
  };
}
