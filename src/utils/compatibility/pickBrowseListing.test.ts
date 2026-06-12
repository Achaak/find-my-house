import { describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import { learnCompatibilityPreferences } from "./learn.js";
import {
  BROWSE_EXPLORE_INTERVAL,
  pickBrowseListing,
} from "./pickBrowseListing.js";

function preferencesFromLikes(
  ...likes: NonNullable<Parameters<typeof makePropertyRow>[0]>[]
) {
  const rows = likes.map((overrides, index) =>
    makePropertyRow({ id: index + 1, ...overrides })
  );
  return learnCompatibilityPreferences(rows);
}

describe("pickBrowseListing", () => {
  it("returns null when there are no candidates", () => {
    expect(pickBrowseListing([], null, 0)).toBeNull();
  });

  it("returns the first candidate when compatibility is not learned yet", () => {
    const candidates = [
      makePropertyRow({ id: 1, price: 200_000 }),
      makePropertyRow({ id: 2, price: 300_000 }),
    ];

    const pick = pickBrowseListing(candidates, null, 0);

    expect(pick?.property.id).toBe(1);
    expect(pick?.isExplore).toBe(false);
  });

  it("prefers high-compatibility listings on regular rounds", () => {
    const preferences = preferencesFromLikes(
      { price: 250_000, surface: 100, rooms: 5, bedrooms: 3, city: "Lyon" },
      { price: 240_000, surface: 95, rooms: 5, bedrooms: 3, city: "Lyon" }
    );

    const strongMatch = makePropertyRow({
      id: 10,
      price: 245_000,
      surface: 98,
      rooms: 5,
      bedrooms: 3,
      city: "Lyon",
    });
    const weakMatch = makePropertyRow({
      id: 11,
      price: 500_000,
      surface: 40,
      rooms: 2,
      bedrooms: 1,
      city: "Paris",
    });

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);

    const pick = pickBrowseListing([weakMatch, strongMatch], preferences, 1);

    randomSpy.mockRestore();

    expect(pick?.property.id).toBe(10);
    expect(pick?.isExplore).toBe(false);
  });

  it("surfaces a low-compatibility listing on explore rounds", () => {
    const preferences = preferencesFromLikes(
      { price: 250_000, surface: 100, rooms: 5, bedrooms: 3, city: "Lyon" },
      { price: 240_000, surface: 95, rooms: 5, bedrooms: 3, city: "Lyon" }
    );

    const strongMatch = makePropertyRow({
      id: 10,
      price: 245_000,
      surface: 98,
      rooms: 5,
      bedrooms: 3,
      city: "Lyon",
    });
    const weakMatch = makePropertyRow({
      id: 11,
      price: 500_000,
      surface: 40,
      rooms: 2,
      bedrooms: 1,
      city: "Paris",
    });

    const pick = pickBrowseListing(
      [strongMatch, weakMatch],
      preferences,
      BROWSE_EXPLORE_INTERVAL
    );

    expect(pick?.property.id).toBe(11);
    expect(pick?.isExplore).toBe(true);
  });
});
