import type { PrismaClient } from "../generated/prisma/client.js";

type PropertyWithId = {
  id: number;
  firstPrice: number;
};

export async function mergePropertiesIntoCanonical(
  prisma: Pick<
    PrismaClient,
    "property" | "listingPublication" | "listingReaction"
  >,
  canonical: PropertyWithId,
  duplicates: PropertyWithId[]
): Promise<void> {
  if (duplicates.length === 0) return;

  for (const duplicate of duplicates) {
    await prisma.listingPublication.updateMany({
      where: { propertyId: duplicate.id },
      data: { propertyId: canonical.id },
    });

    const reactions = await prisma.listingReaction.findMany({
      where: { propertyId: duplicate.id },
    });

    for (const reaction of reactions) {
      const existing = await prisma.listingReaction.findUnique({
        where: {
          discordUserId_propertyId: {
            discordUserId: reaction.discordUserId,
            propertyId: canonical.id,
          },
        },
      });

      if (existing) {
        await prisma.listingReaction.delete({ where: { id: reaction.id } });
      } else {
        await prisma.listingReaction.update({
          where: { id: reaction.id },
          data: { propertyId: canonical.id },
        });
      }
    }

    await prisma.property.delete({ where: { id: duplicate.id } });
  }

  const firstPrice = Math.min(
    canonical.firstPrice,
    ...duplicates.map((duplicate) => duplicate.firstPrice)
  );

  if (firstPrice !== canonical.firstPrice) {
    await prisma.property.update({
      where: { id: canonical.id },
      data: { firstPrice },
    });
  }
}
