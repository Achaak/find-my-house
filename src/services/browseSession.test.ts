import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import {
  advanceBrowseSession,
  clearBrowseSession,
  getBrowseState,
  startBrowseSession,
} from "./browseSession.js";

vi.mock("../services/compatibilityService.js", () => ({
  resolveListingCompatibilityPreferences: vi.fn(() => Promise.resolve(null)),
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

  const reactionRepository = {
    getReactedPropertyIds: vi.fn(() => Promise.resolve(new Set<number>())),
  } as unknown as ReactionRepository;

  return { repository, reactionRepository, search };
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
});
