import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { makePropertyRow } from "../test/listingFixtures.js";
import {
  formatListingEmbedWithCompatibility,
  resetListingCompatibilityCache,
} from "./listingEmbed.js";

function createReactionRepository(
  likes = [makePropertyRow({ id: 1, price: 250_000, surface: 100 })],
  dislikes: ReturnType<typeof makePropertyRow>[] = []
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

  it("includes compatibility score when likes are available", async () => {
    const embed = await formatListingEmbedWithCompatibility(
      makePropertyRow({ price: 255_000, surface: 102 }),
      createReactionRepository(),
      "user-1"
    );

    expect(embed.fields.some((field) => field.name === "Compatibilité")).toBe(
      true
    );
  });

  it("omits compatibility score when there are no likes yet", async () => {
    const embed = await formatListingEmbedWithCompatibility(
      makePropertyRow(),
      createReactionRepository([]),
      "user-1"
    );

    expect(embed.fields.some((field) => field.name === "Compatibilité")).toBe(
      false
    );
  });
});
