import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../../test/listingFixtures.js";
import { buildCompatibilityModel } from "./model.js";
import { buildCompatibilityCard, scoreToTier } from "./present.js";
import { evaluatePropertyCompatibility } from "./evaluate.js";

function makeLike(id: number, overrides: Record<string, unknown> = {}) {
  return makePropertyRow({
    id,
    price: 230_000 + id * 5_000,
    surface: 110 + id,
    landSurface: 1_500 + id * 50,
    rooms: 5,
    bedrooms: 4,
    bathrooms: 1,
    parkingSpaces: 3,
    constructionYear: 1950,
    isNewProperty: false,
    dpeClass: "D",
    highlights: ["Garage", "Jardin"],
    propertyCondition: "Bon état",
    orientation: "Sud",
    ...overrides,
  });
}

function makeDislike(id: number, overrides: Record<string, unknown> = {}) {
  return makePropertyRow({
    id: 100 + id,
    price: 420_000 + id * 10_000,
    surface: 55,
    landSurface: 300,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    parkingSpaces: 0,
    constructionYear: 2010,
    isNewProperty: true,
    dpeClass: "G",
    highlights: ["Balcon"],
    propertyCondition: "Travaux à prévoir",
    orientation: "Nord",
    ...overrides,
  });
}

describe("buildCompatibilityModel calibration", () => {
  it("enables tiers with many likes and dislikes even when score spread is narrow", () => {
    const likes = Array.from({ length: 12 }, (_, index) => makeLike(index + 1));
    const dislikes = Array.from({ length: 8 }, (_, index) =>
      makeDislike(index + 1)
    );

    const model = buildCompatibilityModel(likes, dislikes);
    if (!model?.calibration) {
      throw new Error("Expected compatibility model with calibration");
    }

    expect(model.calibration.signalStrongEnough).toBe(true);
    expect(model.calibration.likeScores.length).toBe(12);
    expect(model.calibration.dislikeScores.length).toBe(8);

    const candidate = makePropertyRow({
      id: 999,
      price: 235_000,
      surface: 118,
      landSurface: 1_699,
      rooms: 6,
      bedrooms: 4,
      isNewProperty: false,
      dpeClass: "D",
    });

    const evaluation = evaluatePropertyCompatibility(candidate, model);
    const card = buildCompatibilityCard(evaluation, model);

    expect(card?.readiness).not.toBe("scoring");
    expect(card?.tier).toBeDefined();
    if (!evaluation) {
      throw new Error("Expected evaluation");
    }
    expect(scoreToTier(evaluation.score, model)).toBeDefined();
  });
});
