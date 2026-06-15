import type { ListingRepository } from "../db/listingRepository.js";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { createLogger } from "../utils/logger.js";
import { isScrapeInProgress } from "./scraperService.js";
import {
  ensurePropertyEnriched,
  propertyNeedsEnrichment,
  type EnrichmentPurpose,
} from "./enrichmentService.js";

const log = createLogger("enrichment-queue");

export type EnrichmentPriority = "high" | "low";

export type EnrichmentJobResult = {
  warnings: string[];
};

type QueueItem = {
  propertyId: number;
  purpose: EnrichmentPurpose;
  priority: EnrichmentPriority;
};

type Waiter = {
  resolve: (result: EnrichmentJobResult) => void;
  reject: (error: unknown) => void;
};

function jobKey(propertyId: number, purpose: EnrichmentPurpose): string {
  return `${String(propertyId)}:${purpose}`;
}

async function waitForScrapeIdle(): Promise<void> {
  while (isScrapeInProgress()) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

export class EnrichmentQueue {
  private readonly queue: QueueItem[] = [];
  private readonly queuedKeys = new Set<string>();
  private readonly waiters = new Map<string, Waiter[]>();
  private draining = false;

  constructor(private readonly repository: ListingRepository) {}

  getQueuedCount(): number {
    return this.queue.length;
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

  async waitUntilEnriched(
    propertyId: number,
    purpose: EnrichmentPurpose,
    priority: EnrichmentPriority = "high"
  ): Promise<EnrichmentJobResult> {
    const property = await this.repository.findById(propertyId);
    if (!property) {
      return { warnings: [] };
    }

    if (!propertyNeedsEnrichment(property, purpose)) {
      return { warnings: [] };
    }

    const key = jobKey(propertyId, purpose);
    return new Promise<EnrichmentJobResult>((resolve, reject) => {
      const pending = this.waiters.get(key) ?? [];
      pending.push({ resolve, reject });
      this.waiters.set(key, pending);
      queueMicrotask(() => {
        this.schedule(propertyId, purpose, priority);
      });
    });
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
    }
  }

  private finishJob(key: string, result: EnrichmentJobResult): void {
    const pending = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of pending) {
      waiter.resolve(result);
    }
  }

  private failJob(key: string, error: unknown): void {
    const pending = this.waiters.get(key) ?? [];
    this.waiters.delete(key);
    for (const waiter of pending) {
      waiter.reject(error);
    }
  }
}
