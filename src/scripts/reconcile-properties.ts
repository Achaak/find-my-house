import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeConfig } from "../config/scrape.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { reconcileProperties } from "../services/reconcileService.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("reconcile");

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
      `Reconciliation complete: ${String(merged)} strict duplicate(s), ${String(fuzzyMerged)} fuzzy duplicate(s), ${String(unique)} unique propert${unique === 1 ? "y" : "ies"}, ${String(agencyFieldsUpdated)} agency publication(s) updated.`
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

export { reconcileProperties } from "../services/reconcileService.js";
