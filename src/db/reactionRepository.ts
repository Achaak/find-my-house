import type { PrismaClient } from "../generated/prisma/client.js";
import type { PropertyRow } from "../types/listing.js";
import { toPropertyRow } from "./listingMapper.js";

export type ReactionType = "like" | "dislike";

const propertyInclude = { publications: true } as const;

export class ReactionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async add(
    discordUserId: string,
    propertyId: number,
    type: ReactionType
  ): Promise<"added" | "already_exists"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
    });

    if (existing?.type === type) {
      return "already_exists";
    }

    await this.prisma.listingReaction.upsert({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      create: { discordUserId, propertyId, type },
      update: { type },
    });

    return "added";
  }

  async remove(
    discordUserId: string,
    propertyId: number,
    type: ReactionType
  ): Promise<boolean> {
    const result = await this.prisma.listingReaction.deleteMany({
      where: { discordUserId, propertyId, type },
    });
    return result.count > 0;
  }

  async toggle(
    discordUserId: string,
    propertyId: number,
    type: ReactionType
  ): Promise<"added" | "removed"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
    });

    if (existing?.type === type) {
      await this.prisma.listingReaction.delete({
        where: {
          discordUserId_propertyId: { discordUserId, propertyId },
        },
      });
      return "removed";
    }

    await this.prisma.listingReaction.upsert({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      create: { discordUserId, propertyId, type },
      update: { type },
    });

    return "added";
  }

  async findListingsByUser(
    discordUserId: string,
    type: ReactionType,
    limit = 10
  ): Promise<PropertyRow[]> {
    const reactions = await this.prisma.listingReaction.findMany({
      where: { discordUserId, type },
      include: { property: { include: propertyInclude } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return reactions.map((reaction) => toPropertyRow(reaction.property));
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
