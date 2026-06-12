import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../generated/prisma/client.js";
import { scrapeConfig } from "../config/scrape.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { createLogger } from "../utils/logger.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const log = createLogger("reconcile");

export async function reconcileProperties(
  prisma: PrismaClient
): Promise<{ merged: number; unique: number }> {
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
      landSurface: property.landSurface,
      propertyType: property.propertyType,
      isNewProperty: property.isNewProperty,
    });

    const group = groups.get(key) ?? [];
    group.push(property);
    groups.set(key, group);
  }

  let merged = 0;

  for (const [, group] of groups) {
    if (group.length <= 1) {
      continue;
    }

    const [canonical, ...duplicates] = group;
    merged += duplicates.length;

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

  const remaining = await prisma.property.findMany();
  const keyUpdates: { id: number; propertyKey: string }[] = [];

  for (const property of remaining) {
    const propertyKey = computePropertyKey({
      postalCode: property.postalCode,
      price: property.price,
      surface: property.surface,
      rooms: property.rooms,
      bedrooms: property.bedrooms,
      landSurface: property.landSurface,
      propertyType: property.propertyType,
      isNewProperty: property.isNewProperty,
    });

    if (property.propertyKey !== propertyKey) {
      keyUpdates.push({ id: property.id, propertyKey });
    }
  }

  for (const { id } of keyUpdates) {
    await prisma.property.update({
      where: { id },
      data: { propertyKey: `__reconcile_${String(id)}` },
    });
  }

  for (const { id, propertyKey } of keyUpdates) {
    await prisma.property.update({
      where: { id },
      data: { propertyKey },
    });
  }

  return { merged, unique: groups.size };
}

/**
 * Merge duplicate properties (same propertyKey) after migration.
 * Run once: pnpm run db:reconcile
 */
async function main(): Promise<void> {
  const prisma = getPrisma(scrapeConfig.database.url);

  try {
    const { merged, unique } = await reconcileProperties(prisma);
    log.info(
      `Réconciliation terminée : ${String(merged)} doublon(s) fusionné(s), ${String(unique)} bien(s) unique(s).`
    );
  } finally {
    await disconnectPrisma();
  }
}

const isDirectRun =
  path.resolve(process.argv[1]) ===
  fileURLToPath(new URL("./reconcile-properties.ts", import.meta.url));

if (isDirectRun) {
  main().catch((error: unknown) => {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
