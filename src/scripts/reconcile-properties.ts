import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../generated/prisma/client.js";
import { mergePropertiesIntoCanonical } from "../db/propertyMerge.js";
import { scrapeConfig } from "../config/scrape.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { createLogger } from "../utils/logger.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import { propertiesMatchFuzzy } from "../utils/propertyMatch.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const log = createLogger("reconcile");

type PropertyRecord = Awaited<
  ReturnType<PrismaClient["property"]["findMany"]>
>[number] & {
  publications: Awaited<
    ReturnType<PrismaClient["listingPublication"]["findMany"]>
  >;
};

function toMatchInput(property: PropertyRecord) {
  return {
    postalCode: property.postalCode,
    price: property.price,
    surface: property.surface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    landSurface: property.landSurface,
    propertyType: property.propertyType,
    isNewProperty: property.isNewProperty,
  };
}

function buildStrictGroups(
  properties: PropertyRecord[]
): Map<string, PropertyRecord[]> {
  const groups = new Map<string, PropertyRecord[]>();

  for (const property of properties) {
    const key = computePropertyKey(toMatchInput(property));
    const group = groups.get(key) ?? [];
    group.push(property);
    groups.set(key, group);
  }

  return groups;
}

function findUnionParent(parents: Map<number, number>, id: number): number {
  const current = parents.get(id);
  if (current === undefined || current === id) return id;

  const root = findUnionParent(parents, current);
  parents.set(id, root);
  return root;
}

function unionIds(parents: Map<number, number>, a: number, b: number): void {
  const rootA = findUnionParent(parents, a);
  const rootB = findUnionParent(parents, b);
  if (rootA !== rootB) {
    parents.set(rootB, rootA);
  }
}

function buildFuzzyGroups(properties: PropertyRecord[]): PropertyRecord[][] {
  const byPostal = new Map<string, PropertyRecord[]>();

  for (const property of properties) {
    if (!property.postalCode) continue;
    const group = byPostal.get(property.postalCode) ?? [];
    group.push(property);
    byPostal.set(property.postalCode, group);
  }

  const parents = new Map<number, number>(
    properties.map((property) => [property.id, property.id])
  );

  for (const group of byPostal.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const left = group[i];
        const right = group[j];

        if (propertiesMatchFuzzy(toMatchInput(left), toMatchInput(right))) {
          unionIds(parents, left.id, right.id);
        }
      }
    }
  }

  const grouped = new Map<number, PropertyRecord[]>();
  for (const property of properties) {
    const root = findUnionParent(parents, property.id);
    const bucket = grouped.get(root) ?? [];
    bucket.push(property);
    grouped.set(root, bucket);
  }

  return [...grouped.values()].filter((group) => group.length > 1);
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

export async function reconcileProperties(prisma: PrismaClient): Promise<{
  merged: number;
  fuzzyMerged: number;
  unique: number;
  agencyFieldsUpdated: number;
}> {
  let merged = 0;
  let fuzzyMerged = 0;

  let properties = await prisma.property.findMany({
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  const strictGroups = buildStrictGroups(properties);

  for (const group of strictGroups.values()) {
    if (group.length <= 1) continue;
    merged += await mergePropertyGroup(prisma, group);
  }

  properties = await prisma.property.findMany({
    include: { publications: true },
    orderBy: { firstSeenAt: "asc" },
  });

  for (const group of buildFuzzyGroups(properties)) {
    fuzzyMerged += await mergePropertyGroup(prisma, group);
  }

  const agencyFieldsUpdated = await backfillBieniciAgencyFields(prisma);
  await refreshPropertyKeys(prisma);

  const unique = await prisma.property.count();

  return { merged, fuzzyMerged, unique, agencyFieldsUpdated };
}

/**
 * Merge duplicate properties (same propertyKey) after migration.
 * Run once: pnpm run db:reconcile
 */
async function main(): Promise<void> {
  const prisma = getPrisma(scrapeConfig.database.url);

  try {
    const { merged, fuzzyMerged, unique, agencyFieldsUpdated } =
      await reconcileProperties(prisma);
    log.info(
      `Réconciliation terminée : ${String(merged)} doublon(s) strict(s), ${String(fuzzyMerged)} doublon(s) fuzzy, ${String(unique)} bien(s) unique(s), ${String(agencyFieldsUpdated)} publication(s) agence mises à jour.`
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
