import type { PrismaClient } from "../../generated/prisma/client.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import { mergePropertiesIntoCanonical } from "../../db/propertyMerge.js";
import { computePropertyDisplayProjection } from "../../domain/propertyProjection.js";
import {
  groupByFuzzyPropertyMatch,
  groupByStrictPropertyKey,
  propertyRecordToPublicationInputs,
} from "../../domain/propertyMatching/index.js";
import { toPropertyMatchInput } from "../../utils/propertyMatch.js";

type PropertyRecord = Awaited<
  ReturnType<PrismaClient["property"]["findMany"]>
>[number] & {
  publications: Awaited<
    ReturnType<PrismaClient["listingPublication"]["findMany"]>
  >;
};

function propertyToMatchInput(property: PropertyRecord) {
  const display = computePropertyDisplayProjection(property.publications);
  return toPropertyMatchInput({
    postalCode: property.postalCode,
    price: property.price,
    surface: property.surface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    landSurface: property.landSurface,
    propertyType: display?.propertyType ?? null,
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

export async function executeReconcilePlan(
  prisma: PrismaClient,
  properties: PropertyRecord[],
  options: { postalCodes?: string[] } = {}
): Promise<Pick<ReconcileResult, "merged" | "fuzzyMerged">> {
  let merged = 0;
  let fuzzyMerged = 0;

  const strictGroups = groupByStrictPropertyKey(
    properties,
    propertyToMatchInput
  );
  for (const group of strictGroups.values()) {
    if (group.length > 1) merged += await mergePropertyGroup(prisma, group);
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
    propertyRecordToPublicationInputs
  )) {
    fuzzyMerged += await mergePropertyGroup(prisma, group);
  }

  return { merged, fuzzyMerged };
}
