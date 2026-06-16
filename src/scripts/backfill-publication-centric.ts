import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeConfig } from "../config/scrape.js";
import { disconnectPrisma, getPrisma } from "../db/prisma.js";
import { ListingRepository } from "../db/listingRepository.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("backfill-publications");
const BATCH_SIZE = 200;

async function main(): Promise<void> {
  const prisma = getPrisma(scrapeConfig.database.url);
  const repository = new ListingRepository(prisma);
  let offset = 0;
  let processed = 0;

  try {
    for (;;) {
      const properties = await prisma.property.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        skip: offset,
        take: BATCH_SIZE,
      });
      if (properties.length === 0) break;

      for (const property of properties) {
        const result = await repository.refreshPropertyProjection(property.id);
        if (!result.ok) {
          log.warn(
            `Projection refresh skipped for property #${String(property.id)}: ${result.error}`
          );
        }
      }

      processed += properties.length;
      offset += properties.length;
      log.info(`Backfill progress: ${String(processed)} properties processed`);
    }

    log.info(`Backfill complete: ${String(processed)} properties processed`);
  } finally {
    await disconnectPrisma();
  }
}

const isDirectRun =
  path.resolve(process.argv.at(1) ?? "") ===
  fileURLToPath(new URL("./backfill-publication-centric.ts", import.meta.url));

if (isDirectRun) {
  main().catch((error: unknown) => {
    log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
