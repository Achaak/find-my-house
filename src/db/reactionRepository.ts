import type { PrismaClient, ReactionType } from "../generated/prisma/client.js";
import type { PropertyRow } from "../types/listing.js";
import { toPropertyRow } from "./listingMapper.js";

export type { ReactionType };

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
      if (type === "like" && existing.archivedAt) {
        await this.prisma.listingReaction.update({
          where: {
            discordUserId_propertyId: { discordUserId, propertyId },
          },
          data: { archivedAt: null },
        });
        return "added";
      }
      return "already_exists";
    }

    await this.prisma.listingReaction.upsert({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      create: { discordUserId, propertyId, type },
      update: { type, archivedAt: null },
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
      update: { type, archivedAt: null },
    });

    return "added";
  }

  async archive(
    discordUserId: string,
    propertyId: number
  ): Promise<"archived" | "not_found" | "already_archived"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
    });

    if (existing?.type !== "like") {
      return "not_found";
    }

    if (existing.archivedAt) {
      return "already_archived";
    }

    await this.prisma.listingReaction.update({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      data: { archivedAt: new Date() },
    });

    return "archived";
  }

  async unarchive(
    discordUserId: string,
    propertyId: number
  ): Promise<"unarchived" | "not_found" | "not_archived"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
    });

    if (existing?.type !== "like") {
      return "not_found";
    }

    if (!existing.archivedAt) {
      return "not_archived";
    }

    await this.prisma.listingReaction.update({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      data: { archivedAt: null },
    });

    return "unarchived";
  }

  async findListingsByUser(
    discordUserId: string,
    type: ReactionType,
    limit = 10
  ): Promise<PropertyRow[]> {
    return this.findListingsByType(type, {
      discordUserId,
      limit,
      excludeArchived: true,
    });
  }

  async findListingsByType(
    type: ReactionType,
    options: {
      discordUserId?: string;
      limit?: number;
      excludeArchived?: boolean;
    } = {}
  ): Promise<PropertyRow[]> {
    const reactions = await this.prisma.listingReaction.findMany({
      where: {
        type,
        ...(options.excludeArchived ? { archivedAt: null } : {}),
        ...(options.discordUserId
          ? { discordUserId: options.discordUserId }
          : {}),
      },
      include: { property: { include: propertyInclude } },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 200,
    });

    return reactions.map((reaction) => toPropertyRow(reaction.property));
  }

  async loadCompatibilityTrainingData(
    discordUserId?: string
  ): Promise<{ likes: PropertyRow[]; dislikes: PropertyRow[] }> {
    const [likes, dislikes] = await Promise.all([
      this.findListingsByType("like", { discordUserId }),
      this.findListingsByType("dislike", { discordUserId }),
    ]);

    return { likes, dislikes };
  }

  async getReaction(
    discordUserId: string,
    propertyId: number
  ): Promise<{ type: ReactionType; archivedAt: Date | null } | null> {
    const reaction = await this.prisma.listingReaction.findUnique({
      where: {
        discordUserId_propertyId: { discordUserId, propertyId },
      },
      select: { type: true, archivedAt: true },
    });
    return reaction ?? null;
  }

  async countByUser(
    discordUserId: string,
    type: ReactionType,
    options: { excludeArchived?: boolean } = {}
  ): Promise<number> {
    const excludeArchived = options.excludeArchived ?? true;
    return this.prisma.listingReaction.count({
      where: {
        discordUserId,
        type,
        ...(excludeArchived ? { archivedAt: null } : {}),
      },
    });
  }
}
