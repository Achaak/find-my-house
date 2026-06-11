import type { ReactionRepository } from "../../db/reactionRepository.js";
import { formatListing } from "../format.js";

export async function formatReactionList(
  reactionRepository: ReactionRepository,
  discordUserId: string,
  type: "like" | "dislike",
  limit: number,
  emptyLabel: string
): Promise<string> {
  const total = await reactionRepository.countByUser(discordUserId, type);
  const listings = await reactionRepository.findListingsByUser(
    discordUserId,
    type,
    limit
  );

  if (listings.length === 0) {
    return emptyLabel;
  }

  const header =
    total > limit
      ? `**${String(total)}** au total — ${String(listings.length)} affichées :`
      : `**${String(total)}** annonce${total > 1 ? "s" : ""} :`;

  return [header, "", listings.map(formatListing).join("\n\n---\n\n")].join(
    "\n"
  );
}
