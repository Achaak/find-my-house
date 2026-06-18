import { describe, expect, it, beforeEach } from "vitest";
import { clearPostalCodeIndexCache } from "../geo/postalCodeLookup.js";
import { applyPostalCodeCoordsToCard } from "./cardCoords.js";
import type { ClassifiedCard } from "./types.js";

describe("applyPostalCodeCoordsToCard", () => {
  beforeEach(() => {
    clearPostalCodeIndexCache();
  });

  it("keeps existing coordinates", () => {
    const card: ClassifiedCard = {
      id: "1",
      cardType: "classified",
      latitude: 48.1,
      longitude: 2.1,
      zipCode: "76400",
    };

    expect(applyPostalCodeCoordsToCard(card)).toEqual(card);
  });

  it("fills coordinates from the postal code index", () => {
    const card: ClassifiedCard = {
      id: "1",
      cardType: "classified",
      zipCode: "76400",
      cityLabel: "Fécamp",
    };

    const enriched = applyPostalCodeCoordsToCard(card);
    expect(enriched.latitude).toBeCloseTo(49.76, 1);
    expect(enriched.longitude).toBeCloseTo(0.38, 1);
  });

  it("leaves cards without a known postal code unchanged", () => {
    const card: ClassifiedCard = {
      id: "1",
      cardType: "classified",
      zipCode: "00000",
    };

    expect(applyPostalCodeCoordsToCard(card)).toEqual(card);
  });
});
