import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import { learnCompatibilityPreferences } from "./learn.js";
import {
  scoreDpeClass,
  scoreNumericTarget,
  scorePrice,
  scorePropertyCompatibility,
  sortByCompatibility,
} from "./score.js";

function preferencesFromLikes(
  ...likes: NonNullable<Parameters<typeof makePropertyRow>[0]>[]
) {
  const rows = likes.map((overrides, index) =>
    makePropertyRow({ id: index + 1, ...overrides })
  );
  const preferences = learnCompatibilityPreferences(rows);
  if (!preferences) {
    throw new Error("Expected learned preferences");
  }
  return preferences;
}

describe("compatibility score", () => {
  it("scores lower prices better up to the ideal target", () => {
    expect(scorePrice(200_000, 240_000, 300_000)).toBe(100);
    expect(scorePrice(300_000, 240_000, 300_000)).toBe(0);
    expect(scorePrice(270_000, 240_000, 300_000)).toBe(50);
  });

  it("scores numeric targets between minimum and ideal", () => {
    expect(scoreNumericTarget(90, 90, 120)).toBe(50);
    expect(scoreNumericTarget(120, 90, 120)).toBe(100);
    expect(scoreNumericTarget(150, 90, 120)).toBe(100);
  });

  it("prefers better DPE classes than the ideal target", () => {
    expect(scoreDpeClass("B", "C")).toBe(100);
    expect(scoreDpeClass("C", "C")).toBe(100);
    expect(scoreDpeClass("E", "C")).toBe(60);
  });

  it("ranks a closer match above a weaker one from learned likes", () => {
    const preferences = preferencesFromLikes(
      {
        price: 230_000,
        surface: 125,
        landSurface: 1_600,
        rooms: 5,
        bedrooms: 4,
        isNewProperty: false,
        dpeClass: "B",
      },
      {
        price: 250_000,
        surface: 120,
        landSurface: 1_500,
        rooms: 5,
        bedrooms: 4,
        isNewProperty: false,
        dpeClass: "C",
      }
    );

    const perfect = makePropertyRow({
      id: 10,
      price: 230_000,
      surface: 125,
      landSurface: 1_600,
      rooms: 5,
      bedrooms: 4,
      isNewProperty: false,
      dpeClass: "B",
    });
    const weaker = makePropertyRow({
      id: 11,
      price: 295_000,
      surface: 92,
      landSurface: 1_050,
      rooms: 4,
      bedrooms: 3,
      isNewProperty: false,
      dpeClass: "E",
    });

    const perfectScore = scorePropertyCompatibility(
      perfect,
      preferences
    )?.score;
    const weakerScore = scorePropertyCompatibility(weaker, preferences)?.score;

    expect(perfectScore).toBeGreaterThan(weakerScore ?? 0);
    expect(sortByCompatibility([weaker, perfect], preferences)[0].id).toBe(10);
  });

  it("applies a penalty when a listing resembles a dislike", () => {
    const preferences = learnCompatibilityPreferences(
      [makePropertyRow({ id: 1, price: 250_000, surface: 100 })],
      [
        makePropertyRow({
          id: 2,
          price: 400_000,
          surface: 60,
          rooms: 2,
          bedrooms: 1,
        }),
      ]
    );
    if (!preferences) {
      throw new Error("Expected learned preferences");
    }

    const similarToDislike = makePropertyRow({
      id: 3,
      price: 395_000,
      surface: 62,
      rooms: 2,
      bedrooms: 1,
    });
    const unlikeDislike = makePropertyRow({
      id: 4,
      price: 255_000,
      surface: 102,
      rooms: 5,
      bedrooms: 4,
    });

    const penalized = scorePropertyCompatibility(
      similarToDislike,
      preferences
    )?.score;
    const preferred = scorePropertyCompatibility(
      unlikeDislike,
      preferences
    )?.score;

    expect(penalized).toBeLessThan(preferred ?? 100);
  });
});
