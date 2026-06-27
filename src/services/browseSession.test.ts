import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import {
  advanceBrowseSession,
  clearBrowseSession,
  getBrowseState,
  rewindBrowseDislike,
  setPendingDislikeUndo,
  startBrowseSession,
} from "./browseSession.js";
import { noteBrowseReaction } from "./browseCandidates.js";

vi.mock("../services/compatibilityService.js", () => ({
  resolveCompatibilityModel: vi.fn(() => Promise.resolve(null)),
}));

const propertyA = makePropertyRow({ id: 1, title: "Maison A" });
const propertyB = makePropertyRow({ id: 2, title: "Maison B" });
const propertyC = makePropertyRow({ id: 3, title: "Maison C" });

function createMocks() {
  const search = vi.fn(() =>
    Promise.resolve({ items: [propertyA, propertyB, propertyC], total: 3 })
  );
  const findById = vi.fn((id: number) =>
    Promise.resolve(
      [propertyA, propertyB, propertyC].find((property) => property.id === id)
    )
  );
  const findByIds = vi.fn((ids: number[]) =>
    Promise.resolve(
      [propertyA, propertyB, propertyC].filter((property) =>
        ids.includes(property.id)
      )
    )
  );
  const listRankedPropertyIds = vi.fn(() =>
    Promise.resolve([propertyA.id, propertyB.id, propertyC.id])
  );

  const repository = {
    search,
    findById,
    findByIds,
    listRankedPropertyIds,
  } as unknown as ListingRepository;

  const removeDislikeWithinGrace = vi.fn(() =>
    Promise.resolve("removed" as const)
  );
  const reactionRepository = {
    getReactedPropertyIds: vi.fn(() => Promise.resolve(new Set<number>())),
    removeDislikeWithinGrace,
  } as unknown as ReactionRepository;

  return { repository, reactionRepository, search, removeDislikeWithinGrace };
}

describe("browseSession", () => {
  const userId = "user-1";

  beforeEach(() => {
    clearBrowseSession(userId);
    vi.clearAllMocks();
  });

  it("getBrowseState returns the current listing without advancing on repeat reads", async () => {
    const { repository, reactionRepository, search } = createMocks();
    const session = startBrowseSession(userId, {});

    const first = await getBrowseState(
      repository,
      reactionRepository,
      userId,
      session
    );
    const second = await getBrowseState(
      repository,
      reactionRepository,
      userId,
      session
    );

    expect(first.property?.id).toBe(propertyA.id);
    expect(second.property?.id).toBe(propertyA.id);
    expect(session.shownCount).toBe(1);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("advanceBrowseSession reuses the candidate pool without another search", async () => {
    const { repository, reactionRepository, search } = createMocks();
    const session = startBrowseSession(userId, {});

    const first = await getBrowseState(
      repository,
      reactionRepository,
      userId,
      session
    );
    const second = await advanceBrowseSession(
      repository,
      reactionRepository,
      userId,
      session
    );

    expect(first.property?.id).toBe(propertyA.id);
    expect(second.property?.id).not.toBe(propertyA.id);
    expect(session.shownCount).toBe(2);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("rewindBrowseDislike restores the disliked property in session", async () => {
    const { repository, reactionRepository, search, removeDislikeWithinGrace } =
      createMocks();
    const session = startBrowseSession(userId, {});

    await getBrowseState(repository, reactionRepository, userId, session);
    noteBrowseReaction(session, propertyA.id);
    const advanced = await advanceBrowseSession(
      repository,
      reactionRepository,
      userId,
      session
    );

    setPendingDislikeUndo(session, {
      dislikedPropertyId: propertyA.id,
      dislikedIsExplore: false,
      advancedToPropertyId: advanced.property?.id ?? null,
      advancedProperty: advanced.property,
    });

    const result = await rewindBrowseDislike(
      repository,
      reactionRepository,
      userId,
      session,
      propertyA.id,
      5_000
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.property?.id).toBe(propertyA.id);
    }
    expect(session.currentPropertyId).toBe(propertyA.id);
    expect(removeDislikeWithinGrace).toHaveBeenCalled();
    expect(search).toHaveBeenCalledTimes(1);
  });
});
