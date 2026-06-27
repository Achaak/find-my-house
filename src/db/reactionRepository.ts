import type { PrismaClient, ReactionType } from "../generated/prisma/client.js";
import type { PropertyRow } from "../types/listing.js";
import {
  toCompatibilityTrainingProperty,
  tryToPropertyRow,
} from "./listingMapper.js";

export type { ReactionType };

const propertyInclude = { publications: true } as const;

export class ReactionRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly onMutation?: () => void
  ) {}

  private notifyMutation(): void {
    this.onMutation?.();
  }

  async add(
    propertyId: number,
    type: ReactionType
  ): Promise<"added" | "already_exists"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
    });

    if (existing?.type === type) {
      if (type === "like" && existing.archivedAt) {
        await this.prisma.listingReaction.update({
          where: { propertyId },
          data: { archivedAt: null },
        });
        this.notifyMutation();
        return "added";
      }
      return "already_exists";
    }

    await this.prisma.listingReaction.upsert({
      where: { propertyId },
      create: { propertyId, type },
      update: { type, archivedAt: null },
    });

    this.notifyMutation();
    return "added";
  }

  async remove(propertyId: number, type: ReactionType): Promise<boolean> {
    const result = await this.prisma.listingReaction.deleteMany({
      where: { propertyId, type },
    });
    if (result.count > 0) {
      this.notifyMutation();
    }
    return result.count > 0;
  }

  async removeDislikeWithinGrace(
    propertyId: number,
    graceMs: number
  ): Promise<"removed" | "not_found" | "grace_expired" | "not_dislike"> {
    const reaction = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
    });

    if (!reaction) return "not_found";
    if (reaction.type !== "dislike") return "not_dislike";

    const ageMs = Date.now() - reaction.createdAt.getTime();
    if (ageMs > graceMs) return "grace_expired";

    await this.prisma.listingReaction.delete({ where: { propertyId } });
    this.notifyMutation();
    return "removed";
  }

  async getReactionCreatedAt(propertyId: number): Promise<Date | null> {
    const reaction = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
      select: { createdAt: true },
    });
    return reaction?.createdAt ?? null;
  }

  async toggle(
    propertyId: number,
    type: ReactionType
  ): Promise<"added" | "removed"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
    });

    if (existing?.type === type) {
      await this.prisma.listingReaction.delete({
        where: { propertyId },
      });
      this.notifyMutation();
      return "removed";
    }

    await this.prisma.listingReaction.upsert({
      where: { propertyId },
      create: { propertyId, type },
      update: { type, archivedAt: null },
    });

    this.notifyMutation();
    return "added";
  }

  async archive(
    propertyId: number
  ): Promise<"archived" | "not_found" | "already_archived"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
    });

    if (existing?.type !== "like") {
      return "not_found";
    }

    if (existing.archivedAt) {
      return "already_archived";
    }

    await this.prisma.listingReaction.update({
      where: { propertyId },
      data: { archivedAt: new Date() },
    });

    return "archived";
  }

  async unarchive(
    propertyId: number
  ): Promise<"unarchived" | "not_found" | "not_archived"> {
    const existing = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
    });

    if (existing?.type !== "like") {
      return "not_found";
    }

    if (!existing.archivedAt) {
      return "not_archived";
    }

    await this.prisma.listingReaction.update({
      where: { propertyId },
      data: { archivedAt: null },
    });

    return "unarchived";
  }

  async findListingsByType(
    type: ReactionType,
    options: {
      limit?: number;
      excludeArchived?: boolean;
      archivedOnly?: boolean;
    } = {}
  ): Promise<PropertyRow[]> {
    const reactions = await this.prisma.listingReaction.findMany({
      where: {
        type,
        ...(options.archivedOnly
          ? { archivedAt: { not: null } }
          : options.excludeArchived !== false
            ? { archivedAt: null }
            : {}),
      },
      include: { property: { include: propertyInclude } },
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 200,
    });

    return reactions.flatMap((reaction) => {
      const property = tryToPropertyRow(reaction.property);
      return property ? [property] : [];
    });
  }

  async loadCompatibilityTrainingData(): Promise<{
    likes: PropertyRow[];
    dislikes: PropertyRow[];
  }> {
    const [likes, dislikes] = await Promise.all([
      this.findTrainingPropertiesByType("like"),
      this.findTrainingPropertiesByType("dislike"),
    ]);

    return { likes, dislikes };
  }

  private async findTrainingPropertiesByType(
    type: ReactionType
  ): Promise<PropertyRow[]> {
    const reactions = await this.prisma.listingReaction.findMany({
      where: { type },
      include: { property: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return reactions.map((reaction) =>
      toCompatibilityTrainingProperty(reaction.property)
    );
  }

  async getReactedPropertyIds(): Promise<Set<number>> {
    const reactions = await this.prisma.listingReaction.findMany({
      select: { propertyId: true },
    });
    return new Set(reactions.map((reaction) => reaction.propertyId));
  }

  async getReaction(
    propertyId: number
  ): Promise<{ type: ReactionType; archivedAt: Date | null } | null> {
    const reaction = await this.prisma.listingReaction.findUnique({
      where: { propertyId },
      select: { type: true, archivedAt: true },
    });
    return reaction ?? null;
  }

  async getReactionsForProperties(
    propertyIds: number[]
  ): Promise<Map<number, { type: ReactionType; archivedAt: Date | null }>> {
    if (propertyIds.length === 0) {
      return new Map();
    }

    const reactions = await this.prisma.listingReaction.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { propertyId: true, type: true, archivedAt: true },
    });

    return new Map(
      reactions.map((reaction) => [
        reaction.propertyId,
        { type: reaction.type, archivedAt: reaction.archivedAt },
      ])
    );
  }

  async countByType(
    type: ReactionType,
    options: { excludeArchived?: boolean } = {}
  ): Promise<number> {
    const excludeArchived = options.excludeArchived ?? true;
    return this.prisma.listingReaction.count({
      where: {
        type,
        ...(excludeArchived ? { archivedAt: null } : {}),
      },
    });
  }
}
