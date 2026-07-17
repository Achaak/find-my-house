import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { ScrapeConfig } from "../config/schema.js";
import type { ExtendedScrapeResult, PropertyRow } from "../types/listing.js";
import { createLogger, type Logger } from "../utils/logger.js";
import { isScrapeInProgress } from "./scraperService.js";
import { ensurePropertyEnriched } from "./enrichmentService.js";
import {
  getEnrichmentStatus,
  propertyNeedsDisplayWork,
  propertyNeedsEnrichment,
  type EnrichmentPurpose,
  type EnrichmentStatus,
} from "./enrichment/criteria.js";
import {
  scheduleEnrichmentBackfill,
  type EnrichmentBackfillOptions,
} from "./enrichmentBackfill.js";

const log = createLogger("enrichment-queue");

export const ENRICHMENT_WAIT_TIMEOUT_MS = 30_000;

export type EnrichmentPriority = "high" | "low";

export type { EnrichmentPurpose, EnrichmentStatus };

type EnrichmentJobResult = {
  warnings: string[];
  timedOut?: boolean;
};

export type EnrichmentBackfillRunOptions = {
  reactionRepository: ReactionRepository;
  enrichment: ScrapeConfig["enrichment"];
  log: Logger;
  trigger: string;
};

type QueueItem = {
  propertyId: number;
  purpose: EnrichmentPurpose;
  priority: EnrichmentPriority;
};

type Waiter = {
  resolve: (result: EnrichmentJobResult) => void;
  reject: (error: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
};

function jobKey(propertyId: number, purpose: EnrichmentPurpose): string {
  return `${String(propertyId)}:${purpose}`;
}

async function waitForScrapeIdle(): Promise<void> {
  while (isScrapeInProgress()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Deep Enrichment module: callers use ensureReady / schedule / runBackfill /
 * getStatus. Criteria and orchestration stay in the implementation.
 */
export class EnrichmentQueue {
  private readonly queue: QueueItem[] = [];
  private readonly queuedKeys = new Set<string>();
  private readonly waiters = new Map<string, Waiter[]>();
  private draining = false;

  constructor(private readonly repository: ListingRepository) {}

  getQueuedCount(): number {
    return this.queue.length;
  }

  getStatus(
    property: PropertyRow,
    purpose: EnrichmentPurpose
  ): EnrichmentStatus {
    return getEnrichmentStatus(property, purpose);
  }

  async countPendingDisplay(): Promise<number> {
    return this.repository.countPendingDisplayEnrichment();
  }

  schedule(
    propertyId: number,
    purpose: EnrichmentPurpose,
    priority: EnrichmentPriority = "low"
  ): void {
    const key = jobKey(propertyId, purpose);
    if (this.queuedKeys.has(key)) {
      return;
    }

    this.queuedKeys.add(key);
    const item: QueueItem = { propertyId, purpose, priority };
    if (priority === "high") {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }

    void this.drain();
  }

  scheduleScrapeResults(result: ExtendedScrapeResult): void {
    const seen = new Set<number>();
    for (const listing of [
      ...result.insertedListings,
      ...result.linkedListings,
      ...result.priceDropListings,
    ]) {
      if (seen.has(listing.id)) continue;
      seen.add(listing.id);
      this.schedule(listing.id, "display", "low");
    }
  }

  /**
   * Wait until the property is ready for purpose, then return the fresh row.
   */
  async ensureReady(
    propertyId: number,
    purpose: EnrichmentPurpose,
    priority: EnrichmentPriority = "high",
    timeoutMs = ENRICHMENT_WAIT_TIMEOUT_MS
  ): Promise<PropertyRow | null> {
    const property = await this.repository.findById(propertyId);
    if (!property) {
      return null;
    }

    const needsWork =
      purpose === "display"
        ? propertyNeedsDisplayWork(property)
        : propertyNeedsEnrichment(property, purpose);
    if (!needsWork) {
      return property;
    }

    const key = jobKey(propertyId, purpose);
    await new Promise<EnrichmentJobResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(key, waiter);
        resolve({
          warnings: ["Enrichment timed out"],
          timedOut: true,
        });
      }, timeoutMs);

      const waiter: Waiter = {
        resolve,
        reject,
        timer,
      };

      const pending = this.waiters.get(key) ?? [];
      pending.push(waiter);
      this.waiters.set(key, pending);

      queueMicrotask(() => {
        this.schedule(propertyId, purpose, priority);
      });
    });

    return (await this.repository.findById(propertyId)) ?? null;
  }

  async runBackfill(options: EnrichmentBackfillRunOptions): Promise<number> {
    const { enrichment, reactionRepository, log: runLog, trigger } = options;
    if (!enrichment.enabled) return 0;
    if (this.getQueuedCount() > 0) {
      runLog.info(
        `Enrichment backfill (${trigger}): skipped — queue already has ${String(this.getQueuedCount())} job(s)`
      );
      return 0;
    }

    try {
      const backfillOptions: EnrichmentBackfillOptions = {
        minScore: enrichment.minCompatScore,
        limit: enrichment.batchLimit,
        searchLimit: enrichment.searchLimit,
      };
      const scheduled = await scheduleEnrichmentBackfill(
        this.repository,
        reactionRepository,
        this,
        backfillOptions
      );

      const pending = await this.countPendingDisplay();
      if (scheduled > 0) {
        runLog.info(
          `Enrichment backfill (${trigger}): ${String(scheduled)} queued, ${String(pending)} pending`
        );
      } else if (pending > 0) {
        runLog.warn(
          `Enrichment backfill (${trigger}): 0 queued but ${String(pending)} still pending`
        );
      } else {
        runLog.info(`Enrichment backfill (${trigger}): nothing pending`);
      }

      return scheduled;
    } catch (error) {
      runLog.error(`Enrichment backfill error (${trigger}):`, error);
      return 0;
    }
  }

  private removeWaiter(key: string, target: Waiter): void {
    const pending = this.waiters.get(key);
    if (!pending) return;

    const next = pending.filter((waiter) => waiter !== target);
    if (next.length === 0) {
      this.waiters.delete(key);
    } else {
      this.waiters.set(key, next);
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;

    try {
      while (this.queue.length > 0) {
        await waitForScrapeIdle();

        const item = this.queue.shift();
        if (!item) continue;

        const key = jobKey(item.propertyId, item.purpose);
        try {
          const { warnings } = await ensurePropertyEnriched(
            this.repository,
            item.propertyId,
            item.purpose
          );
          this.finishJob(key, { warnings });
        } catch (error) {
          log.error(
            `Enrichment failed for property ${String(item.propertyId)} (${item.purpose}):`,
            error
          );
          this.failJob(key, error);
        } finally {
          this.queuedKeys.delete(key);
        }
      }
    } finally {
      this.draining = false;
      if (this.queue.length > 0) {
        void this.drain();
      }
    }
  }

  private finishJob(key: string, result: EnrichmentJobResult): void {
    const pending = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of pending) {
      clearTimeout(waiter.timer);
      waiter.resolve(result);
    }
  }

  private failJob(key: string, error: unknown): void {
    const pending = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of pending) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }
}
