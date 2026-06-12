import { describe, expect, it } from "vitest";
import {
  highlightsFromTags,
  parseBathroomsFromTags,
  parseConstructionYear,
  parseConstructionYearFromText,
  sanitizeConstructionYear,
  sanitizePositiveNumber,
} from "./amenities.js";

describe("amenities", () => {
  it("keeps informative keyfacts and drops structural counts", () => {
    expect(
      highlightsFromTags([
        "6 pièces",
        "4 chambres",
        "Garage",
        "Piscine",
        "Terrain de 800 m²",
      ])
    ).toEqual(["Garage", "Piscine"]);
  });

  it("parses bathrooms and construction year from tags", () => {
    expect(parseBathroomsFromTags(["2 salles de bain", "Garage"])).toBe(2);
    expect(
      parseConstructionYearFromText("Maison de 1930 avec chauffage individuel")
    ).toBe(1930);
  });

  it("drops invalid numeric listing fields", () => {
    expect(sanitizePositiveNumber(0)).toBeNull();
    expect(sanitizePositiveNumber(85)).toBe(85);
    expect(sanitizeConstructionYear(0)).toBeNull();
    expect(sanitizeConstructionYear(17)).toBeNull();
    expect(sanitizeConstructionYear(1975)).toBe(1975);
    expect(parseConstructionYear("17")).toBeNull();
    expect(parseConstructionYear("1975")).toBe(1975);
  });
});
