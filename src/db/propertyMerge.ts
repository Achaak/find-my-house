import type { PrismaClient } from "../generated/prisma/client.js";

type PropertyWithId = {
  id: number;
  firstPrice: number;
  price: number;
};

type ReactionRow = {
  id: number;
  type: "like" | "dislike";
  archivedAt: Date | null;
  createdAt: Date;
};

type MergePrisma = Pick<
  PrismaClient,
  "property" | "listingPublication" | "listingReaction" | "$transaction"
>;

/** When both properties have a reaction, keep the newer household signal. */
export function pickReactionOnMerge(
  canonical: ReactionRow,
  duplicate: ReactionRow
): ReactionRow {
  if (canonical.type === duplicate.type) {
    return canonical;
  }
  return duplicate.createdAt > canonical.createdAt ? duplicate : canonical;
}

export async function mergePropertiesIntoCanonical(
  prisma: MergePrisma,
  canonical: PropertyWithId,
  duplicates: PropertyWithId[]
): Promise<void> {
  if (duplicates.length === 0) return;

  await prisma.$transaction(async (tx) => {
    for (const duplicate of duplicates) {
      await tx.listingPublication.updateMany({
        where: { propertyId: duplicate.id },
        data: { propertyId: canonical.id },
      });

      const reactions = await tx.listingReaction.findMany({
        where: { propertyId: duplicate.id },
      });

      for (const reaction of reactions) {
        const existing = await tx.listingReaction.findUnique({
          where: { propertyId: canonical.id },
        });

        if (!existing) {
          await tx.listingReaction.update({
            where: { id: reaction.id },
            data: { propertyId: canonical.id },
          });
          continue;
        }

        const winner = pickReactionOnMerge(existing, reaction);
        if (winner.id === existing.id) {
          await tx.listingReaction.delete({ where: { id: reaction.id } });
        } else {
          await tx.listingReaction.update({
            where: { id: existing.id },
            data: {
              type: winner.type,
              archivedAt: winner.archivedAt,
            },
          });
          await tx.listingReaction.delete({ where: { id: reaction.id } });
        }
      }

      await tx.property.delete({ where: { id: duplicate.id } });
    }

    const firstPrice = Math.min(
      canonical.firstPrice,
      ...duplicates.map((duplicate) => duplicate.firstPrice)
    );

    if (firstPrice !== canonical.firstPrice) {
      await tx.property.update({
        where: { id: canonical.id },
        data: {
          firstPrice,
          hasPriceDrop: canonical.price < firstPrice,
        },
      });
    }
  });
}
