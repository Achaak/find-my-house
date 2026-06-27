import type { PrismaClient } from "../generated/prisma/client.js";

/** Removes properties with no publications (e.g. after a bad migration or partial scrape). */
export async function purgeOrphanProperties(
  prisma: PrismaClient
): Promise<number> {
  const result = await prisma.property.deleteMany({
    where: { publications: { none: {} } },
  });
  return result.count;
}
