import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { makeListing } from "../test/listingFixtures.js";
import { ensurePropertyEnriched } from "./enrichmentService.js";
import { EnrichmentQueue } from "./enrichmentQueue.js";

vi.mock("./enrichmentService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentService.js")>();
  return {
    ...actual,
    ensurePropertyEnriched: vi.fn(),
  };
});

const mockEnsurePropertyEnriched = vi.mocked(ensurePropertyEnriched);

describe("EnrichmentQueue", () => {
  let repository: ListingRepository;
  let reactionRepository: ReactionRepository;
  let dispose: (() => Promise<void>) | undefined;
  let queue: EnrichmentQueue;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnsurePropertyEnriched.mockImplementation(
      async (repository, propertyId: number) => {
        await repository.applyEnrichment(propertyId, {
          description: "Enriched",
          imageUrl: "https://example.com/photo.jpg",
          landSurface: 100,
          dpeClass: "C",
          gesClass: "C",
          dpeConsumptionKwhM2: 100,
          gesEmissionKgM2: 20,
        });
        return { property: undefined, warnings: [] };
      }
    );

    const testDb = createTestRepository();
    repository = testDb.repository;
    reactionRepository = testDb.reactionRepository;
    dispose = testDb.dispose;
    queue = new EnrichmentQueue(repository);

    await repository.upsert(
      makeListing({
        externalId: "queue-1",
        description: null,
        imageUrl: null,
      })
    );
  });

  afterEach(async () => {
    await dispose?.();
  });

  it("deduplicates scheduled jobs for the same property and purpose", async () => {
    const { items } = await repository.search({ limit: 1 });
    const property = items[0];

    queue.schedule(property.id, "display", "low");
    queue.schedule(property.id, "display", "low");

    expect(queue.getQueuedCount()).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockEnsurePropertyEnriched).toHaveBeenCalledTimes(1);
    expect(queue.getQueuedCount()).toBe(0);
  });

  it("returns immediately when the listing is already enriched", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "queue-complete-1",
        description: "Already complete",
        imageUrl: "https://example.com/photo.jpg",
        dpeConsumptionKwhM2: 100,
        gesEmissionKgM2: 20,
      })
    );
    const propertyId = inserted.row?.id;
    if (propertyId === undefined) throw new Error("Expected property id");

    const publication = inserted.row?.publications[0];
    if (publication) {
      await repository.applyPublicationGallery(publication.id, {
        imageUrls: null,
        imageLocalHashes: null,
      });
      await repository.markEnrichmentAttempted(propertyId, "display");
    }

    const ready = await queue.ensureReady(propertyId, "display", "high");
    expect(ready?.id).toBe(propertyId);
    expect(mockEnsurePropertyEnriched).not.toHaveBeenCalled();
  });

  it("returns the current row when enrichment times out", async () => {
    const { items } = await repository.search({ limit: 1 });
    const property = items[0];

    mockEnsurePropertyEnriched.mockImplementation(
      () => new Promise(() => undefined)
    );

    const ready = await queue.ensureReady(property.id, "display", "high", 50);

    expect(ready?.id).toBe(property.id);
    expect(mockEnsurePropertyEnriched).toHaveBeenCalled();
  });

  it("ensureReady returns the refreshed property row", async () => {
    const { items } = await repository.search({ limit: 1 });
    const property = items[0];

    const ready = await queue.ensureReady(property.id, "display", "high");

    expect(ready?.id).toBe(property.id);
    expect(mockEnsurePropertyEnriched).toHaveBeenCalled();
  });

  it("schedules enrichment for newly linked listings after a scrape", async () => {
    const { items } = await repository.search({ limit: 1 });
    const property = items[0];

    queue.scheduleScrapeResults({
      found: 1,
      inserted: 0,
      linked: 1,
      updated: 0,
      skipped: 0,
      deactivated: 0,
      insertedListings: [],
      linkedListings: [property],
      priceDropListings: [],
      errors: [],
    });

    expect(queue.getQueuedCount()).toBe(1);
  });

  it("runBackfill queues pending listings once", async () => {
    await repository.upsertMany([
      makeListing({
        externalId: "backfill-pending",
        url: "https://www.bienici.com/annonce/backfill-pending",
        description: null,
        imageUrl: null,
      }),
    ]);

    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const scheduled = await queue.runBackfill({
      reactionRepository,
      enrichment: {
        cron: "0 * * * *",
        enabled: true,
        minCompatScore: 0,
        batchLimit: 10,
        searchLimit: 1000,
      },
      log,
      trigger: "startup",
    });

    expect(scheduled).toBeGreaterThan(0);
    await vi.waitFor(
      () => {
        expect(mockEnsurePropertyEnriched).toHaveBeenCalled();
      },
      { timeout: 5_000 }
    );
    expect(log.info).toHaveBeenCalledWith(expect.stringContaining("queued"));
  });
});
