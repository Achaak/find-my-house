import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ReactionRepository } from "./reactionRepository.js";
import type { ListingRepository } from "./listingRepository.js";

describe("ReactionRepository", () => {
  let reactionRepository: ReactionRepository;
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;
  let propertyId: number;

  beforeAll(async () => {
    const testDb = createTestRepository();
    reactionRepository = testDb.reactionRepository;
    repository = testDb.repository;
    dispose = testDb.dispose;

    const result = await repository.upsertMany([
      makeListing({
        externalId: "reaction-repo",
        url: "https://www.bienici.com/annonce/reaction-repo",
      }),
    ]);

    propertyId = (result.insertedListings[0] ?? result.linkedListings[0]).id;
  });

  afterAll(async () => {
    await dispose?.();
  });

  describe("add", () => {
    it("creates a new reaction", async () => {
      const result = await reactionRepository.add(propertyId, "like");
      expect(result).toBe("added");

      const reaction = await reactionRepository.getReaction(propertyId);
      expect(reaction).toEqual({ type: "like", archivedAt: null });
    });

    it("returns already_exists for the same type", async () => {
      const result = await reactionRepository.add(propertyId, "like");
      expect(result).toBe("already_exists");
    });

    it("changes type when switching from like to dislike", async () => {
      const result = await reactionRepository.add(propertyId, "dislike");
      expect(result).toBe("added");

      const reaction = await reactionRepository.getReaction(propertyId);
      expect(reaction?.type).toBe("dislike");
    });

    it("unarchives an archived like when re-adding", async () => {
      await reactionRepository.add(propertyId, "like");
      await reactionRepository.archive(propertyId);

      const result = await reactionRepository.add(propertyId, "like");
      expect(result).toBe("added");

      const reaction = await reactionRepository.getReaction(propertyId);
      expect(reaction).toEqual({ type: "like", archivedAt: null });
    });
  });

  describe("toggle", () => {
    it("removes an existing reaction of the same type", async () => {
      await reactionRepository.add(propertyId, "like");

      const result = await reactionRepository.toggle(propertyId, "like");
      expect(result).toBe("removed");
      expect(await reactionRepository.getReaction(propertyId)).toBeNull();
    });

    it("adds a reaction when none exists", async () => {
      const result = await reactionRepository.toggle(propertyId, "dislike");
      expect(result).toBe("added");
      expect((await reactionRepository.getReaction(propertyId))?.type).toBe(
        "dislike"
      );
    });

    it("switches type when toggling a different reaction", async () => {
      await reactionRepository.add(propertyId, "dislike");

      const result = await reactionRepository.toggle(propertyId, "like");
      expect(result).toBe("added");
      expect((await reactionRepository.getReaction(propertyId))?.type).toBe(
        "like"
      );
    });
  });

  describe("remove", () => {
    it("removes a matching reaction", async () => {
      await reactionRepository.add(propertyId, "like");

      const removed = await reactionRepository.remove(propertyId, "like");
      expect(removed).toBe(true);
      expect(await reactionRepository.getReaction(propertyId)).toBeNull();
    });

    it("returns false when the type does not match", async () => {
      await reactionRepository.add(propertyId, "like");

      const removed = await reactionRepository.remove(propertyId, "dislike");
      expect(removed).toBe(false);
    });
  });

  describe("archive / unarchive", () => {
    it("archives a like", async () => {
      await reactionRepository.add(propertyId, "like");

      const result = await reactionRepository.archive(propertyId);
      expect(result).toBe("archived");

      const reaction = await reactionRepository.getReaction(propertyId);
      expect(reaction?.archivedAt).toBeInstanceOf(Date);
    });

    it("returns not_found when archiving a dislike", async () => {
      await reactionRepository.add(propertyId, "dislike");

      const result = await reactionRepository.archive(propertyId);
      expect(result).toBe("not_found");
    });

    it("unarchives an archived like", async () => {
      await reactionRepository.add(propertyId, "like");
      await reactionRepository.archive(propertyId);

      const result = await reactionRepository.unarchive(propertyId);
      expect(result).toBe("unarchived");

      const reaction = await reactionRepository.getReaction(propertyId);
      expect(reaction?.archivedAt).toBeNull();
    });
  });

  describe("getReactionsForProperties", () => {
    it("returns reactions keyed by property id", async () => {
      const reactions = await reactionRepository.getReactionsForProperties([
        propertyId,
        propertyId + 999,
      ]);

      expect(reactions.get(propertyId)?.type).toBe("like");
      expect(reactions.has(propertyId + 999)).toBe(false);
    });
  });

  describe("countByType", () => {
    it("excludes archived likes by default", async () => {
      await reactionRepository.add(propertyId, "like");
      await reactionRepository.archive(propertyId);

      const activeLikes = await reactionRepository.countByType("like");
      const allLikes = await reactionRepository.countByType("like", {
        excludeArchived: false,
      });

      expect(activeLikes).toBe(0);
      expect(allLikes).toBe(1);
    });
  });
});
