import type { PrismaClient } from "../generated/prisma/client.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import { mergePropertiesIntoCanonical } from "../db/propertyMerge.js";
import {
  groupByFuzzyPropertyMatch,
  groupByStrictPropertyKey,
  toPropertyMatchInput,
} from "../domain/propertyDedup.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import { createLogger } from "../utils/logger.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const log = createLogger("reconcile");

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

async function reconcilePropertyRecords(
  prisma: PrismaClient,
  properties: PropertyRecord[],
  options: {
    postalCodes?: string[];
    refreshKeys?: boolean;
  } = {}
): Promise<Pick<ReconcileResult, "merged" | "fuzzyMerged">> {
  let merged = 0;
  let fuzzyMerged = 0;

  const strictGroups = groupByStrictPropertyKey(
    properties,
    propertyToMatchInput
  );

  for (const group of strictGroups.values()) {
    if (group.length <= 1) continue;
    merged += await mergePropertyGroup(prisma, group);
  }

  const remaining = await prisma.property.findMany({
    ...(options.postalCodes
      ? { where: { postalCode: { in: options.postalCodes } } }
      : {}),
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  for (const group of groupByFuzzyPropertyMatch(
    remaining,
    propertyToMatchInput
  )) {
    fuzzyMerged += await mergePropertyGroup(prisma, group);
  }

  if (options.refreshKeys !== false) {
    await refreshPropertyKeys(prisma);
  }

  return { merged, fuzzyMerged };
}

export async function reconcilePropertiesInPostalCodes(
  prisma: PrismaClient,
  postalCodes: string[]
): Promise<Pick<ReconcileResult, "merged" | "fuzzyMerged">> {
  const uniquePostalCodes = [
    ...new Set(postalCodes.filter((postalCode) => postalCode.length > 0)),
  ];
  if (uniquePostalCodes.length === 0) {
    return { merged: 0, fuzzyMerged: 0 };
  }

  const properties = await prisma.property.findMany({
    where: { postalCode: { in: uniquePostalCodes } },
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  if (properties.length <= 1) {
    return { merged: 0, fuzzyMerged: 0 };
  }

  const result = await reconcilePropertyRecords(prisma, properties, {
    postalCodes: uniquePostalCodes,
    refreshKeys: true,
  });

  if (result.merged > 0 || result.fuzzyMerged > 0) {
    log.info(
      `Postal reconcile ${uniquePostalCodes.join(", ")}: ${String(result.merged)} strict, ${String(result.fuzzyMerged)} fuzzy`
    );
  }

  return result;
}

export async function reconcileProperties(
  prisma: PrismaClient
): Promise<ReconcileResult> {
  const properties = await prisma.property.findMany({
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  const { merged, fuzzyMerged } = await reconcilePropertyRecords(
    prisma,
    properties,
    { refreshKeys: false }
  );

  const agencyFieldsUpdated = await backfillBieniciAgencyFields(prisma);
  await refreshPropertyKeys(prisma);

  const unique = await prisma.property.count();

  if (merged > 0 || fuzzyMerged > 0) {
    log.info(
      `Reconcile complete: ${String(merged)} strict, ${String(fuzzyMerged)} fuzzy, ${String(unique)} unique`
    );
  }

  return { merged, fuzzyMerged, unique, agencyFieldsUpdated };
}
