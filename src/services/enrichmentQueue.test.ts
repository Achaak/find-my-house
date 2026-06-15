import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import type { ListingRepository } from "../db/listingRepository.js";
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

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockEnsurePropertyEnriched).toHaveBeenCalledTimes(1);
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

    await expect(
      queue.waitUntilEnriched(propertyId, "display", "high")
    ).resolves.toEqual({ warnings: [] });
    expect(mockEnsurePropertyEnriched).not.toHaveBeenCalled();
  });
});
