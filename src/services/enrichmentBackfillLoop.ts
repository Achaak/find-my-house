import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScrapeConfig } from "../config/schema.js";
import type { Logger } from "../utils/logger.js";
import { scheduleEnrichmentBackfill } from "./enrichmentBackfill.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export type EnrichmentBackfillLoopContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  queue: EnrichmentQueue;
  enrichment: ScrapeConfig["enrichment"];
  log: Logger;
  intervalMs?: number;
};

export function startEnrichmentBackfillLoop(
  ctx: EnrichmentBackfillLoopContext
): () => void {
  let running = false;

  const tick = async (trigger: string): Promise<void> => {
    if (!ctx.enrichment.enabled) return;
    if (running) return;
    if (ctx.queue.getQueuedCount() > 0) return;

    running = true;
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
      }
    } catch (error) {
      ctx.log.error(`Enrichment backfill error (${trigger}):`, error);
    } finally {
      running = false;
    }
  };

  ctx.queue.setOnDrainIdle(() => {
    void tick("idle");
  });

  const interval = setInterval(() => {
    void tick("interval");
  }, ctx.intervalMs ?? DEFAULT_INTERVAL_MS);

  void tick("startup");

  return () => {
    clearInterval(interval);
  };
}
