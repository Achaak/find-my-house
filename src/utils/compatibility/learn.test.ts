import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import { learnCompatibilityPreferences } from "./learn.js";

describe("learnCompatibilityPreferences", () => {
  it("returns null when there are no likes", () => {
    expect(learnCompatibilityPreferences([], [])).toBeNull();
  });

  it("derives targets from liked listings", () => {
    const likes = [
      makePropertyRow({
        id: 1,
        price: 250_000,
        surface: 100,
        landSurface: 1_200,
        rooms: 5,
        bedrooms: 4,
        isNewProperty: false,
        dpeClass: "C",
      }),
      makePropertyRow({
        id: 2,
        price: 270_000,
        surface: 110,
        landSurface: 1_400,
        rooms: 5,
        bedrooms: 3,
        isNewProperty: false,
        dpeClass: "B",
      }),
    ];

    const preferences = learnCompatibilityPreferences(likes);

    expect(preferences).not.toBeNull();
    expect(preferences?.idealPrice).toBe(260_000);
    expect(preferences?.idealSurface).toBe(105);
    expect(preferences?.idealRooms).toBe(5);
    expect(preferences?.idealBedrooms).toBe(3.5);
    expect(preferences?.idealDpeClass).toBe("B");
    expect(preferences?.ancienOnly).toBe(true);
  });

  it("keeps disliked listings for penalty scoring", () => {
    const likes = [makePropertyRow({ id: 1, price: 250_000 })];
    const dislikes = [makePropertyRow({ id: 2, price: 400_000 })];

    const preferences = learnCompatibilityPreferences(likes, dislikes);

    expect(preferences?.dislikes).toHaveLength(1);
    expect(preferences?.dislikes?.[0]?.id).toBe(2);
  });
});
