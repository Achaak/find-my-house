import type { PrismaClient } from "../generated/prisma/client.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import { createLogger } from "../utils/logger.js";
import { executeReconcilePlan } from "./reconcile/executor.js";
import { refreshPropertyKeys } from "./reconcile/planner.js";
import { backfillBieniciAgencyFields } from "./reconcile/agencyBackfill.js";

const log = createLogger("reconcile");

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

  const result = await executeReconcilePlan(prisma, properties, {
    postalCodes: uniquePostalCodes,
  });
  await refreshPropertyKeys(prisma);

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

  const { merged, fuzzyMerged } = await executeReconcilePlan(
    prisma,
    properties
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
