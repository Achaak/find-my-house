import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { EnrichmentQueue } from "./enrichmentQueue.js";
import { runEnrichmentBackfill } from "./enrichmentBackfillLoop.js";
import { ensurePropertyEnriched } from "./enrichmentService.js";

vi.mock("./enrichmentService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./enrichmentService.js")>();
  return {
    ...actual,
    ensurePropertyEnriched: vi.fn().mockResolvedValue({
      property: undefined,
      warnings: [],
    }),
  };
});

const mockEnsurePropertyEnriched = vi.mocked(ensurePropertyEnriched);

describe("runEnrichmentBackfill", () => {
  let repository: ListingRepository;
  let reactionRepository: ReactionRepository;
  let dispose: (() => Promise<void>) | undefined;
  let queue: EnrichmentQueue;

  beforeEach(async () => {
    vi.clearAllMocks();
    const testDb = createTestRepository();
    repository = testDb.repository;
    reactionRepository = testDb.reactionRepository;
    dispose = testDb.dispose;
    queue = new EnrichmentQueue(repository);

    await repository.upsertMany([
      makeListing({
        externalId: "loop-pending",
        url: "https://www.bienici.com/annonce/loop-pending",
        description: null,
        imageUrl: null,
      }),
    ]);
  });

  afterEach(async () => {
    await dispose?.();
  });

  it("queues pending listings once without idle refill", async () => {
    const log = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const scheduled = await runEnrichmentBackfill(
      {
        repository,
        reactionRepository,
        queue,
        enrichment: {
          cron: "0 * * * *",
          enabled: true,
          minCompatScore: 0,
          batchLimit: 10,
          searchLimit: 1000,
        },
        log,
      },
      "startup"
    );

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
