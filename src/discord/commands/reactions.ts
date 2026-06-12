import type { PropertyRow } from "../../types/listing.js";
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

export function formatRecentListingsEmbed(
  total: number,
  publications: number,
  recent: PropertyRow[]
) {
  return {
    color: 0x5865f2,
    title: "Statistiques",
    description: `**${String(total)}** biens enregistrés\n**${String(publications)}** publications actives`,
    fields:
      recent.length > 0
        ? [
            {
              name: "Derniers biens",
              value: recent
                .map((listing) => {
                  const sources = [
                    ...new Set(listing.publications.map((p) => p.source)),
                  ].join(", ");
                  return `• **#${String(listing.id)}** ${listing.title}\n  ${listing.city} · ${sources}`;
                })
                .join("\n")
                .slice(0, 1024),
            },
          ]
        : [
            {
              name: "Derniers biens",
              value: "_Aucune annonce pour le moment_",
            },
          ],
  };
}
