import type { PrismaClient } from "../generated/prisma/client.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import { mergePropertiesIntoCanonical } from "../db/propertyMerge.js";
import {
  groupByFuzzyPropertyMatch,
  groupByStrictPropertyKey,
  toPropertyMatchInput,
} from "../domain/propertyDedup.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import { computePropertyKey } from "../utils/propertyKey.js";

type PropertyRecord = Awaited<
  ReturnType<PrismaClient["property"]["findMany"]>
>[number] & {
  publications: Awaited<
    ReturnType<PrismaClient["listingPublication"]["findMany"]>
  >;
};

function propertyToMatchInput(property: PropertyRecord) {
  return toPropertyMatchInput({
    postalCode: property.postalCode,
    price: property.price,
    surface: property.surface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    landSurface: property.landSurface,
    propertyType: property.propertyType,
    isNewProperty: property.isNewProperty,
  });
}

async function mergePropertyGroup(
  prisma: PrismaClient,
  group: PropertyRecord[]
): Promise<number> {
  const [canonical, ...duplicates] = [...group].sort(
    (a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime()
  );

  await mergePropertiesIntoCanonical(prisma, canonical, duplicates);
  return duplicates.length;
}

async function backfillBieniciAgencyFields(
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

async function refreshPropertyKeys(prisma: PrismaClient): Promise<void> {
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
}

export async function reconcileProperties(
  prisma: PrismaClient
): Promise<ReconcileResult> {
  let merged = 0;
  let fuzzyMerged = 0;

  let properties = await prisma.property.findMany({
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  const strictGroups = groupByStrictPropertyKey(
    properties,
    propertyToMatchInput
  );

  for (const group of strictGroups.values()) {
    if (group.length <= 1) continue;
    merged += await mergePropertyGroup(prisma, group);
  }

  properties = await prisma.property.findMany({
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  for (const group of groupByFuzzyPropertyMatch(
    properties,
    propertyToMatchInput
  )) {
    fuzzyMerged += await mergePropertyGroup(prisma, group);
  }

  const agencyFieldsUpdated = await backfillBieniciAgencyFields(prisma);
  await refreshPropertyKeys(prisma);

  const unique = await prisma.property.count();

  return { merged, fuzzyMerged, unique, agencyFieldsUpdated };
}
