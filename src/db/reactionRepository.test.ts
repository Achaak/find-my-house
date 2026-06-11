import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "../generated/prisma/client.js";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "./listingRepository.js";
import type { ReactionRepository } from "./reactionRepository.js";

describe("ReactionRepository", () => {
  let repository: ListingRepository;
  let reactionRepository: ReactionRepository;
  let prisma: PrismaClient;
  let dispose: (() => Promise<void>) | undefined;
  let propertyId: number;

  beforeAll(async () => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    reactionRepository = testDb.reactionRepository;
    prisma = testDb.prisma;
    dispose = testDb.dispose;

    const inserted = await repository.upsert(
      makeListing({ externalId: "reaction-target" })
    );
    if (!inserted.row) {
      throw new Error("Expected inserted property row");
    }
    propertyId = inserted.row.id;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("adds a new reaction", async () => {
    const result = await reactionRepository.add("user-1", propertyId, "like");

    expect(result).toBe("added");
    expect(await reactionRepository.countByUser("user-1", "like")).toBe(1);
  });

  it("returns already_exists when the same reaction is added twice", async () => {
    await reactionRepository.add("user-dup", propertyId, "like");
    const second = await reactionRepository.add("user-dup", propertyId, "like");

    expect(second).toBe("already_exists");
    expect(await reactionRepository.countByUser("user-dup", "like")).toBe(1);
  });

  it("updates the reaction type when adding a different type", async () => {
    await reactionRepository.add("user-switch", propertyId, "like");
    const result = await reactionRepository.add(
      "user-switch",
      propertyId,
      "dislike"
    );

    expect(result).toBe("added");
    expect(await reactionRepository.countByUser("user-switch", "like")).toBe(0);
    expect(await reactionRepository.countByUser("user-switch", "dislike")).toBe(
      1
    );
  });

  it("removes an existing reaction", async () => {
    await reactionRepository.add("user-remove", propertyId, "dislike");

    const removed = await reactionRepository.remove(
      "user-remove",
      propertyId,
      "dislike"
    );
    const missing = await reactionRepository.remove(
      "user-remove",
      propertyId,
      "dislike"
    );

    expect(removed).toBe(true);
    expect(missing).toBe(false);
    expect(await reactionRepository.countByUser("user-remove", "dislike")).toBe(
      0
    );
  });

  it("toggles a reaction on and off", async () => {
    const added = await reactionRepository.toggle(
      "user-toggle",
      propertyId,
      "like"
    );
    const removed = await reactionRepository.toggle(
      "user-toggle",
      propertyId,
      "like"
    );

    expect(added).toBe("added");
    expect(removed).toBe("removed");
    expect(await reactionRepository.countByUser("user-toggle", "like")).toBe(0);
  });

  it("switches reaction type when toggling a different type", async () => {
    await reactionRepository.toggle("user-toggle-type", propertyId, "like");

    const switched = await reactionRepository.toggle(
      "user-toggle-type",
      propertyId,
      "dislike"
    );

    expect(switched).toBe("added");
    expect(
      await reactionRepository.countByUser("user-toggle-type", "like")
    ).toBe(0);
    expect(
      await reactionRepository.countByUser("user-toggle-type", "dislike")
    ).toBe(1);
  });

  it("returns listings for a user ordered by most recent reaction", async () => {
    const second = await repository.upsert(
      makeListing({
        externalId: "reaction-second",
        url: "https://www.bienici.com/annonce/reaction-second",
        postalCode: "75002",
        price: 310_000,
      })
    );

    if (!second.row) {
      throw new Error("Expected second property row");
    }

    await reactionRepository.add("user-list", propertyId, "like");
    await reactionRepository.add("user-list", second.row.id, "like");

    // SQLite timestamps are second-precision; force distinct values for ordering.
    await prisma.listingReaction.updateMany({
      where: { discordUserId: "user-list", propertyId },
      data: { createdAt: new Date("2026-01-01T10:00:00.000Z") },
    });
    await prisma.listingReaction.updateMany({
      where: { discordUserId: "user-list", propertyId: second.row.id },
      data: { createdAt: new Date("2026-01-02T10:00:00.000Z") },
    });

    const listings = await reactionRepository.findListingsByUser(
      "user-list",
      "like",
      10
    );

    expect(listings).toHaveLength(2);
    expect(listings[0]?.id).toBe(second.row.id);
    expect(listings[1]?.id).toBe(propertyId);
  });
});
