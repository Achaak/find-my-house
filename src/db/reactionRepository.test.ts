import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ReactionRepository } from "./reactionRepository.js";
import type { ListingRepository } from "./listingRepository.js";

describe("ReactionRepository.getReactionsForProperties", () => {
  let reactionRepository: ReactionRepository;
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;
  let propertyId: number;
  const userId = "user-batch";

  beforeAll(async () => {
    const testDb = createTestRepository();
    reactionRepository = testDb.reactionRepository;
    repository = testDb.repository;
    dispose = testDb.dispose;

    const result = await repository.upsertMany([
      makeListing({
        externalId: "reaction-batch",
        url: "https://www.bienici.com/annonce/reaction-batch",
      }),
    ]);

    propertyId = (result.insertedListings[0] ?? result.linkedListings[0]).id;
    await reactionRepository.add(userId, propertyId, "like");
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("returns reactions keyed by property id", async () => {
    const reactions = await reactionRepository.getReactionsForProperties(
      userId,
      [propertyId, propertyId + 999]
    );

    expect(reactions.get(propertyId)).toEqual({
      type: "like",
      archivedAt: null,
    });
    expect(reactions.has(propertyId + 999)).toBe(false);
  });
});
