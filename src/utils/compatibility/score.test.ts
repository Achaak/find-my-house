import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import { buildCompatibilityModel } from "./model.js";
import {
  scoreConstructionYear,
  scoreDpeClass,
  scoreHighlightsMatch,
  scoreNumericTarget,
  scoreRenovationCondition,
  scorePrice,
} from "./legacyScore.js";
import { evaluatePropertyCompatibility, sortByCompatibility } from "./score.js";

function modelFromLikes(
  ...likes: NonNullable<Parameters<typeof makePropertyRow>[0]>[]
) {
  const rows = likes.map((overrides, index) =>
    makePropertyRow({ id: index + 1, ...overrides })
  );
  const model = buildCompatibilityModel(rows);
  if (!model) {
    throw new Error("Expected learned model");
  }
  return model;
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

  it("scores construction year proximity and highlight overlap", () => {
    expect(scoreConstructionYear(1970, 1972)).toBe(100);
    expect(scoreConstructionYear(1985, 1970)).toBeLessThan(100);
    expect(scoreHighlightsMatch(["Garage", "Jardin"], ["Garage", "Cave"])).toBe(
      50
    );
    expect(scoreRenovationCondition("Travaux à prévoir", true)).toBe(0);
    expect(scoreRenovationCondition("Bon état", true)).toBe(100);
  });

  it("ranks a closer match above a weaker one from learned likes", () => {
    const model = modelFromLikes(
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
      },
      {
        price: 240_000,
        surface: 122,
        landSurface: 1_550,
        rooms: 5,
        bedrooms: 4,
        isNewProperty: false,
        dpeClass: "B",
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

    const perfectScore = evaluatePropertyCompatibility(perfect, model)?.score;
    const weakerScore = evaluatePropertyCompatibility(weaker, model)?.score;

    expect(perfectScore).toBeGreaterThan(weakerScore ?? 0);
    expect(sortByCompatibility([weaker, perfect], model)[0].id).toBe(10);
  });

  it("applies a penalty when a listing resembles a dislike", () => {
    const model = buildCompatibilityModel(
      [
        makePropertyRow({ id: 1, price: 250_000, surface: 100, rooms: 5 }),
        makePropertyRow({ id: 2, price: 255_000, surface: 102, rooms: 5 }),
        makePropertyRow({ id: 3, price: 248_000, surface: 98, rooms: 5 }),
      ],
      [
        makePropertyRow({
          id: 4,
          price: 400_000,
          surface: 60,
          rooms: 2,
          bedrooms: 1,
        }),
      ]
    );
    if (!model) {
      throw new Error("Expected learned model");
    }

    const similarToDislike = makePropertyRow({
      id: 5,
      price: 395_000,
      surface: 62,
      rooms: 2,
      bedrooms: 1,
    });
    const unlikeDislike = makePropertyRow({
      id: 6,
      price: 255_000,
      surface: 102,
      rooms: 5,
      bedrooms: 4,
    });

    const penalized = evaluatePropertyCompatibility(
      similarToDislike,
      model
    )?.score;
    const preferred = evaluatePropertyCompatibility(
      unlikeDislike,
      model
    )?.score;

    expect(penalized).toBeLessThan(preferred ?? 100);
  });

  it("favors listings that match learned amenities", () => {
    const model = modelFromLikes(
      {
        bathrooms: 2,
        parkingSpaces: 2,
        constructionYear: 1975,
        highlights: ["Garage", "Jardin"],
        propertyCondition: "Bon état",
        heating: "Gaz",
        price: 250_000,
        surface: 110,
      },
      {
        bathrooms: 2,
        parkingSpaces: 1,
        constructionYear: 1978,
        highlights: ["Garage", "Cave"],
        propertyCondition: "Bon état",
        heating: "Gaz",
        price: 250_000,
        surface: 110,
      },
      {
        bathrooms: 2,
        parkingSpaces: 2,
        constructionYear: 1976,
        highlights: ["Garage", "Jardin"],
        propertyCondition: "Bon état",
        heating: "Gaz",
        price: 250_000,
        surface: 110,
      }
    );

    const strongMatch = makePropertyRow({
      id: 20,
      price: 250_000,
      surface: 110,
      bathrooms: 2,
      parkingSpaces: 2,
      constructionYear: 1976,
      highlights: ["Garage", "Jardin"],
      propertyCondition: "Bon état",
      heating: "Gaz individuel",
    });
    const weakMatch = makePropertyRow({
      id: 21,
      price: 250_000,
      surface: 110,
      bathrooms: 1,
      parkingSpaces: 0,
      constructionYear: 1920,
      highlights: ["Piscine"],
      propertyCondition: "Travaux à prévoir",
      heating: "Électrique",
    });

    const strongScore = evaluatePropertyCompatibility(
      strongMatch,
      model
    )?.score;
    const weakScore = evaluatePropertyCompatibility(weakMatch, model)?.score;

    expect(strongScore).toBeGreaterThan(weakScore ?? 0);
  });
});
