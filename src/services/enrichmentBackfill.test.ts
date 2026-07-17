import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { PropertyRow } from "../types/listing.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { resolveCompatibilityModel } from "./compatibilityService.js";
import { scheduleEnrichmentBackfill } from "./enrichmentBackfill.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";
import { getCompatibilityScore } from "../utils/compatibility/score.js";

vi.mock("./compatibilityService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./compatibilityService.js")>();
  return {
    ...actual,
    resolveCompatibilityModel: vi.fn(),
  };
});

vi.mock("../utils/compatibility/score.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/compatibility/score.js")>();
  return {
    ...actual,
    getCompatibilityScore: vi.fn(),
  };
});

const mockResolveModel = vi.mocked(resolveCompatibilityModel);
const mockGetScore = vi.mocked(getCompatibilityScore);

function publicationExternalId(property: PropertyRow): string | undefined {
  return property.publications[0]?.externalId;
}

describe("scheduleEnrichmentBackfill", () => {
  let repository: ListingRepository;
  let reactionRepository: ReactionRepository;
  let schedule: ReturnType<typeof vi.fn>;
  let queue: EnrichmentQueue;
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockResolveModel.mockResolvedValue({
      likes: [],
      dislikes: [],
      likeCount: 1,
      dislikeCount: 0,
      weights: { price: 100 },
      profile: {},
      calibration: {
        scoreMin: 0,
        scoreMax: 100,
        signalStrongEnough: false,
        likeScores: [],
        dislikeScores: [],
      },
    });
    schedule = vi.fn();
    queue = { schedule } as unknown as EnrichmentQueue;

    const testDb = createTestRepository();
    repository = testDb.repository;
    reactionRepository = testDb.reactionRepository;
    dispose = testDb.dispose;

    await repository.upsertMany([
      makeListing({
        externalId: "backfill-low",
        url: "https://www.bienici.com/annonce/backfill-low",
        description: null,
        imageUrl: null,
        price: 200_000,
      }),
      makeListing({
        externalId: "backfill-high",
        url: "https://www.bienici.com/annonce/backfill-high",
        description: null,
        imageUrl: null,
        price: 250_000,
      }),
      makeListing({
        externalId: "backfill-complete",
        url: "https://www.bienici.com/annonce/backfill-complete",
        description: "Done",
        imageUrl: "https://example.com/photo.jpg",
        dpeConsumptionKwhM2: 100,
        gesEmissionKgM2: 20,
      }),
    ]);

    const seeded = await repository.search({ limit: 10 });
    for (const property of seeded.items) {
      if (publicationExternalId(property) !== "backfill-complete") continue;
      for (const publication of property.publications) {
        await repository.applyPublicationGallery(publication.id, {
          imageUrls: null,
          imageLocalHashes: null,
        });
        await repository.markPublicationEnrichmentAttempted(
          publication.id,
          "display"
        );
      }
    }
  });

  afterEach(async () => {
    await dispose?.();
  });

  it("queues pending listings even without compatibility preferences", async () => {
    mockResolveModel.mockResolvedValue(null);

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { limit: 10 }
    );

    expect(scheduled).toBe(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it("prioritises higher-compatibility pending listings when preferences exist", async () => {
    const { items } = await repository.search({ limit: 10 });
    const high = items.find(
      (item) => publicationExternalId(item) === "backfill-high"
    );

    mockGetScore.mockImplementation((property: PropertyRow) => {
      if (publicationExternalId(property) === "backfill-high") return 85;
      if (publicationExternalId(property) === "backfill-low") return 55;
      return 0;
    });

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { minScore: 70, limit: 5 }
    );

    expect(scheduled).toBe(1);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(schedule).toHaveBeenCalledWith(high?.id, "display", "low");
  });

  it("queues all pending listings when minScore is 0", async () => {
    mockGetScore.mockImplementation((property: PropertyRow) => {
      if (publicationExternalId(property) === "backfill-high") return 85;
      if (publicationExternalId(property) === "backfill-low") return 55;
      return 0;
    });

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { minScore: 0, limit: 10 }
    );

    expect(scheduled).toBe(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it("queues enriched listings that still need local image storage", async () => {
    const { items } = await repository.search({ limit: 10 });
    const pending = items.find(
      (item) => publicationExternalId(item) === "backfill-low"
    );
    if (!pending) throw new Error("Expected backfill-low listing");

    for (const publication of pending.publications) {
      await repository.applyPublicationGallery(publication.id, {
        imageUrls: ["https://example.com/photo.jpg"],
        imageLocalHashes: null,
      });
      await repository.markPublicationEnrichmentAttempted(
        publication.id,
        "display"
      );
    }

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { limit: 10 }
    );

    expect(scheduled).toBeGreaterThanOrEqual(1);
    expect(schedule).toHaveBeenCalledWith(pending.id, "display", "low");
  });

  it("respects the batch limit", async () => {
    mockGetScore.mockReturnValue(90);

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { minScore: 0, limit: 1 }
    );

    expect(scheduled).toBe(1);
    expect(schedule).toHaveBeenCalledTimes(1);
  });

  it("falls back to all pending listings when minScore filters everything out", async () => {
    mockGetScore.mockReturnValue(10);

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { minScore: 80, limit: 10 }
    );

    expect(scheduled).toBe(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it("does not treat enriched listings with no photos as pending", async () => {
    const { items } = await repository.search({ limit: 10 });
    for (const property of items) {
      for (const publication of property.publications) {
        await repository.applyPublicationGallery(publication.id, {
          imageUrls: [],
          imageLocalHashes: {},
        });
        await repository.markPublicationEnrichmentAttempted(
          publication.id,
          "display"
        );
      }
    }

    const pendingCount = await repository.countPendingDisplayEnrichment();
    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { limit: 10 }
    );

    expect(pendingCount).toBe(0);
    expect(scheduled).toBe(0);
    expect(schedule).not.toHaveBeenCalled();
  });

  it("still queues real pending work when the catalog has many no-photo enriched listings", async () => {
    await repository.upsertMany(
      Array.from({ length: 8 }, (_, index) =>
        makeListing({
          externalId: `ghost-${String(index)}`,
          url: `https://www.bienici.com/annonce/ghost-${String(index)}`,
          description: "Already enriched",
          imageUrl: null,
          imageUrls: [],
          scrapedAt: `2026-01-0${String(index + 1)}T10:00:00.000Z`,
        })
      )
    );

    const { items } = await repository.search({ limit: 50 });
    for (const property of items) {
      const externalId = publicationExternalId(property);
      if (!externalId?.startsWith("ghost-")) continue;
      for (const publication of property.publications) {
        await repository.applyPublicationGallery(publication.id, {
          imageUrls: [],
          imageLocalHashes: {},
        });
        await repository.markPublicationEnrichmentAttempted(
          publication.id,
          "display"
        );
      }
    }

    const scheduled = await scheduleEnrichmentBackfill(
      repository,
      reactionRepository,
      queue,
      { limit: 10, searchLimit: 5 }
    );

    expect(await repository.countPendingDisplayEnrichment()).toBe(2);
    expect(scheduled).toBe(2);
    expect(schedule).toHaveBeenCalledTimes(2);
  });
});
