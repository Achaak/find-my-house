import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { makePropertyRow } from "../test/listingFixtures.js";
import {
  formatListingEmbedWithCompatibility,
  resetListingCompatibilityCache,
} from "./listingEmbed.js";

function createReactionRepository(
  likes = [
    makePropertyRow({ id: 1, price: 250_000, surface: 100, rooms: 5 }),
    makePropertyRow({ id: 2, price: 245_000, surface: 98, rooms: 5 }),
    makePropertyRow({ id: 3, price: 255_000, surface: 102, rooms: 5 }),
  ],
  dislikes: ReturnType<typeof makePropertyRow>[] = [
    makePropertyRow({ id: 4, price: 500_000, surface: 40, rooms: 2 }),
  ]
): ReactionRepository {
  return {
    loadCompatibilityTrainingData: vi.fn(() =>
      Promise.resolve({ likes, dislikes })
    ),
  } as unknown as ReactionRepository;
}

describe("listingEmbed", () => {
  afterEach(() => {
    resetListingCompatibilityCache();
  });

  it("includes compatibility tier when likes are available", async () => {
    const embed = await formatListingEmbedWithCompatibility(
      makePropertyRow({ price: 255_000, surface: 102, rooms: 5 }),
      createReactionRepository()
    );

    expect(embed.fields.some((field) => field.name === "Adéquation")).toBe(
      true
    );
  });

  it("omits compatibility when there are no likes yet", async () => {
    const embed = await formatListingEmbedWithCompatibility(
      makePropertyRow(),
      createReactionRepository([])
    );

    expect(embed.fields.some((field) => field.name === "Adéquation")).toBe(
      false
    );
  });
});
