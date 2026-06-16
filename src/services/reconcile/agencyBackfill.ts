import type { PrismaClient } from "../../generated/prisma/client.js";
import { parseBieniciAgency } from "../../utils/bienici/agency.js";

export async function backfillBieniciAgencyFields(
  prisma: PrismaClient
): Promise<number> {
  const publications = await prisma.listingPublication.findMany({
    where: {
      source: "bienici",
      OR: [{ agencySlug: null }, { agencyRef: null }],
    },
    select: { id: true, externalId: true },
  });

  let updated = 0;
  for (const publication of publications) {
    const agency = parseBieniciAgency(publication.externalId);
    if (!agency) continue;
    await prisma.listingPublication.update({
      where: { id: publication.id },
      data: {
        agencySlug: agency.agencySlug,
        agencyRef: agency.agencyRef,
      },
    });
    updated++;
  }
  return updated;
}
