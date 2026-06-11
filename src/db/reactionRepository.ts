import type { PrismaClient } from "../generated/prisma/client.js";
import type { ListingRow } from "../types/listing.js";
import { toListingRow } from "./listingMapper.js";

export type ReactionType = "like" | "dislike";

export class ReactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(
    discordUserId: string,
    listingId: number,
    type: ReactionType
  ): Promise<"added" | "already_exists"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_listingId: { discordUserId, listingId },
      },
    });

    if (existing?.type === type) {
      return "already_exists";
    }

    await this.prisma.listingReaction.upsert({
      where: {
        discordUserId_listingId: { discordUserId, listingId },
      },
      create: { discordUserId, listingId, type },
      update: { type },
    });

    return "added";
  }

  async remove(
    discordUserId: string,
    listingId: number,
    type: ReactionType
  ): Promise<boolean> {
    const result = await this.prisma.listingReaction.deleteMany({
      where: { discordUserId, listingId, type },
    });
    return result.count > 0;
  }

  async toggle(
    discordUserId: string,
    listingId: number,
    type: ReactionType
  ): Promise<"added" | "removed"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_listingId: { discordUserId, listingId },
      },
    });

    if (existing?.type === type) {
      await this.prisma.listingReaction.delete({
        where: {
          discordUserId_listingId: { discordUserId, listingId },
        },
      });
      return "removed";
    }

    await this.prisma.listingReaction.upsert({
      where: {
        discordUserId_listingId: { discordUserId, listingId },
      },
      create: { discordUserId, listingId, type },
      update: { type },
    });

    return "added";
  }

  async findListingsByUser(
    discordUserId: string,
    type: ReactionType,
    limit = 10
  ): Promise<ListingRow[]> {
    const reactions = await this.prisma.listingReaction.findMany({
      where: { discordUserId, type },
      include: { listing: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return reactions.map((reaction) => toListingRow(reaction.listing));
  }

  async countByUser(
    discordUserId: string,
    type: ReactionType
  ): Promise<number> {
    return this.prisma.listingReaction.count({
      where: { discordUserId, type },
    });
  }
}
