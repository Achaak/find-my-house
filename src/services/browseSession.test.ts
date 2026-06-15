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

function createMocks() {
  const search = vi.fn(() =>
    Promise.resolve({ items: [propertyA, propertyB], total: 2 })
  );
  const findById = vi.fn((id: number) =>
    Promise.resolve(
      id === propertyA.id
        ? propertyA
        : id === propertyB.id
          ? propertyB
          : undefined
    )
  );

  const repository = {
    search,
    findById,
  } as unknown as ListingRepository;

  const reactionRepository = {} as ReactionRepository;

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

  it("advanceBrowseSession moves to the next listing", async () => {
    const { repository, reactionRepository, search } = createMocks();
    search
      .mockResolvedValueOnce({ items: [propertyA, propertyB], total: 2 })
      .mockResolvedValueOnce({ items: [propertyB], total: 1 });

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
    expect(second.property?.id).toBe(propertyB.id);
    expect(session.shownCount).toBe(2);
    expect(search).toHaveBeenCalledTimes(2);
  });
});
