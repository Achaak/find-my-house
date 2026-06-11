import { config } from "../config.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { computePropertyKey } from "../utils/propertyKey.js";

/**
 * Fusionne les biens en doublon (même propertyKey) après migration.
 * À lancer une fois : pnpm run db:reconcile
 */
async function main(): Promise<void> {
  const prisma = getPrisma(config.database.url);

  try {
    const properties = await prisma.property.findMany({
      include: { publications: true },
      orderBy: { firstSeenAt: "asc" },
    });

    const groups = new Map<string, typeof properties>();

    for (const property of properties) {
      const key = computePropertyKey({
        postalCode: property.postalCode,
        price: property.price,
        surface: property.surface,
        rooms: property.rooms,
        bedrooms: property.bedrooms,
      });

      const group = groups.get(key) ?? [];
      group.push(property);
      groups.set(key, group);
    }

    let merged = 0;

    for (const [propertyKey, group] of groups) {
      if (group.length <= 1) {
        const sole = group[0];
        if (sole.propertyKey !== propertyKey) {
          await prisma.property.update({
            where: { id: sole.id },
            data: { propertyKey },
          });
        }
        continue;
      }

      const [canonical, ...duplicates] = group;
      merged += duplicates.length;

      const firstPrice = Math.min(
        canonical.firstPrice,
        ...duplicates.map((duplicate) => duplicate.firstPrice)
      );

      await prisma.property.update({
        where: { id: canonical.id },
        data: { propertyKey, firstPrice },
      });

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
    }

    console.log(
      `Réconciliation terminée : ${String(merged)} doublon(s) fusionné(s), ${String(groups.size)} bien(s) unique(s).`
    );
  } finally {
    await disconnectPrisma();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
