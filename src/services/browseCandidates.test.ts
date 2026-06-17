import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { startBrowseSession } from "./browseSession.js";
import {
  ensureBrowsePool,
  noteBrowseReaction,
  pickNextFromBrowsePool,
} from "./browseCandidates.js";

const propertyA = makePropertyRow({ id: 1, title: "Maison A" });
const propertyB = makePropertyRow({ id: 2, title: "Maison B" });

function createMocks() {
  const search = vi.fn(() =>
    Promise.resolve({ items: [propertyA, propertyB], total: 2 })
  );
  const findByIds = vi.fn((ids: number[]) =>
    Promise.resolve(
      [propertyA, propertyB].filter((property) => ids.includes(property.id))
    )
  );

  const repository = {
    search,
    findByIds,
    listRankedPropertyIds: vi.fn(() =>
      Promise.resolve([propertyA.id, propertyB.id])
    ),
  } as unknown as ListingRepository;

  const reactionRepository = {
    getReactedPropertyIds: vi.fn(() => Promise.resolve(new Set<number>())),
  } as unknown as ReactionRepository;

  return { repository, reactionRepository, search };
}

describe("browseCandidates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fills the pool once and serves multiple picks from memory", async () => {
    const { repository, reactionRepository, search } = createMocks();
    const session = startBrowseSession("user-1", {});

    const first = await pickNextFromBrowsePool(
      repository,
      reactionRepository,
      session,
      null
    );
    const second = await pickNextFromBrowsePool(
      repository,
      reactionRepository,
      session,
      null
    );

    expect(first?.property.id).toBe(propertyA.id);
    expect(second?.property.id).toBe(propertyB.id);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("drops reacted listings from the pool without waiting for a refill", async () => {
    const { repository, reactionRepository } = createMocks();
    const session = startBrowseSession("user-1", {});
    await ensureBrowsePool(session, repository, reactionRepository);

    noteBrowseReaction(session, propertyB.id);

    expect(session.candidatePool.some((property) => property.id === 2)).toBe(
      false
    );
  });
});
