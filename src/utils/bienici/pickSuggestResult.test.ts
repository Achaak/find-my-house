import { describe, expect, it } from "vitest";
import type { BienIciSuggestResult } from "./suggest.js";
import {
  pickBienIciPlaceResult,
  pickSuggestResult,
} from "./pickSuggestResult.js";

const bbox = { west: 0, south: 49, east: 1, north: 50 };

const saintMartin76: BienIciSuggestResult = {
  name: "Saint-Martin",
  insee_code: "76390",
  postalCodes: ["76140"],
  boundingBox: bbox,
  zoneIds: ["z1"],
};

const saintMartin54: BienIciSuggestResult = {
  name: "Saint-Martin",
  insee_code: "54480",
  postalCodes: ["54330"],
  boundingBox: bbox,
  zoneIds: ["z2"],
};

describe("pickSuggestResult", () => {
  it("prefers the name match when no postal code is given", () => {
    expect(
      pickSuggestResult([saintMartin54, saintMartin76], "Saint-Martin")
        ?.insee_code
    ).toBe("54480");
  });

  it("disambiguates homonyms with a postal code", () => {
    expect(
      pickSuggestResult([saintMartin54, saintMartin76], "Saint-Martin", "76140")
        ?.insee_code
    ).toBe("76390");
  });

  it("falls back to postal code when the city name differs slightly", () => {
    expect(
      pickSuggestResult([saintMartin54, saintMartin76], "Saint Martin", "76140")
        ?.insee_code
    ).toBe("76390");
  });
});

describe("pickBienIciPlaceResult", () => {
  it("requires zone IDs for BienIci ads search", () => {
    const withoutZones: BienIciSuggestResult = {
      name: "Villeexemple",
      insee_code: "12345",
      postalCodes: ["69001"],
      boundingBox: bbox,
    };

    expect(
      pickBienIciPlaceResult([withoutZones], "Villeexemple", "69001")
    ).toBeUndefined();
  });
});
