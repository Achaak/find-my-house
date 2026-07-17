import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScrapeConfig } from "../config/schema.js";
import type { Logger } from "../utils/logger.js";
import { scheduleEnrichmentBackfill } from "./enrichmentBackfill.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";

export type EnrichmentBackfillDriverContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  queue: EnrichmentQueue;
  enrichment: ScrapeConfig["enrichment"];
  log: Logger;
};

/**
 * Single Enrichment backfill driver: runs on demand (startup / cron callback).
 * No idle refill conveyor — pacing is owned by the caller (hourly cron).
 */
export async function runEnrichmentBackfill(
  ctx: EnrichmentBackfillDriverContext,
  trigger: string
): Promise<number> {
  if (!ctx.enrichment.enabled) return 0;
  if (ctx.queue.getQueuedCount() > 0) {
    ctx.log.info(
      `Enrichment backfill (${trigger}): skipped — queue already has ${String(ctx.queue.getQueuedCount())} job(s)`
    );
    return 0;
  }

  try {
    const scheduled = await scheduleEnrichmentBackfill(
      ctx.repository,
      ctx.reactionRepository,
      ctx.queue,
      {
        minScore: ctx.enrichment.minCompatScore,
        limit: ctx.enrichment.batchLimit,
        searchLimit: ctx.enrichment.searchLimit,
      }
    );

    const pending = await ctx.repository.countPendingDisplayEnrichment();
    if (scheduled > 0) {
      ctx.log.info(
        `Enrichment backfill (${trigger}): ${String(scheduled)} queued, ${String(pending)} pending`
      );
    } else if (pending > 0) {
      ctx.log.warn(
        `Enrichment backfill (${trigger}): 0 queued but ${String(pending)} still pending`
      );
    } else {
      ctx.log.info(`Enrichment backfill (${trigger}): nothing pending`);
    }

    return scheduled;
  } catch (error) {
    ctx.log.error(`Enrichment backfill error (${trigger}):`, error);
    return 0;
  }
}

/** @deprecated Use runEnrichmentBackfill — no continuous loop. */
export function startEnrichmentBackfillLoop(
  ctx: EnrichmentBackfillDriverContext
): () => void {
  void runEnrichmentBackfill(ctx, "startup");
  return () => undefined;
}
