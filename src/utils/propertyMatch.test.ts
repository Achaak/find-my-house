import { describe, expect, it } from "vitest";
import {
  propertiesMatchFuzzy,
  PROPERTY_MATCH_THRESHOLD,
  scorePropertyMatch,
} from "./propertyMatch.js";

const base = {
  postalCode: "76170",
  price: 229_000,
  surface: 125,
  rooms: 5,
  bedrooms: 3,
  landSurface: 2000,
  propertyType: "Maison",
  isNewProperty: false,
};

describe("scorePropertyMatch", () => {
  it("matches the Bréauté cross-portal case when Logic-Immo lacks surface", () => {
    const leboncoin = {
      postalCode: "76110",
      price: 239_000,
      surface: 110,
      rooms: 4,
      bedrooms: 3,
      landSurface: 2142,
      propertyType: "Maison",
      isNewProperty: false,
    };
    const logicimmo = {
      postalCode: "76110",
      price: 239_000,
      surface: null,
      rooms: 4,
      bedrooms: 3,
      landSurface: 2140,
      propertyType: "Maison à vendre",
      isNewProperty: null,
    };

    const result = scorePropertyMatch(leboncoin, logicimmo);
    expect(result.veto).toBeUndefined();
    expect(result.score).toBeGreaterThanOrEqual(PROPERTY_MATCH_THRESHOLD);
    expect(propertiesMatchFuzzy(leboncoin, logicimmo)).toBe(true);
  });

  it("matches the Yvetot cross-portal case when portals disagree on isNewProperty", () => {
    const leboncoin = {
      postalCode: "76190",
      price: 240_000,
      surface: 170,
      rooms: 5,
      bedrooms: 3,
      landSurface: 48_000,
      propertyType: "Propriété",
      isNewProperty: false,
    };
    const logicimmo = {
      postalCode: "76190",
      price: 240_000,
      surface: 170,
      rooms: 5,
      bedrooms: 3,
      landSurface: 48_000,
      propertyType: "Maison",
      isNewProperty: null,
    };

    const result = scorePropertyMatch(leboncoin, logicimmo);
    expect(result.veto).toBeUndefined();
    expect(result.score).toBe(1);
    expect(propertiesMatchFuzzy(leboncoin, logicimmo)).toBe(true);
  });

  it("rejects different homes at the same price with conflicting surface", () => {
    const result = scorePropertyMatch(base, { ...base, surface: 126 });
    expect(result.veto).toBe("numeric_mismatch");
    expect(propertiesMatchFuzzy(base, { ...base, surface: 126 })).toBe(false);
  });

  it("rejects conflicting room counts when both portals provide them", () => {
    const result = scorePropertyMatch(base, { ...base, rooms: 4 });
    expect(result.veto).toBe("numeric_mismatch");
    expect(propertiesMatchFuzzy(base, { ...base, rooms: 4 })).toBe(false);
  });
});

describe("propertiesMatchFuzzy", () => {
  it("matches when price differs within tolerance", () => {
    expect(propertiesMatchFuzzy(base, { ...base, price: 225_000 })).toBe(true);
  });

  it("matches when land surface is missing on one side", () => {
    expect(propertiesMatchFuzzy(base, { ...base, landSurface: null })).toBe(
      true
    );
  });

  it("matches when land surface differs within tolerance", () => {
    expect(propertiesMatchFuzzy(base, { ...base, landSurface: 2100 })).toBe(
      true
    );
  });

  it("matches when isNewProperty is null on one side", () => {
    expect(propertiesMatchFuzzy(base, { ...base, isNewProperty: null })).toBe(
      true
    );
  });

  it("rejects conflicting isNewProperty values", () => {
    expect(propertiesMatchFuzzy(base, { ...base, isNewProperty: true })).toBe(
      false
    );
  });

  it("rejects different surfaces", () => {
    expect(propertiesMatchFuzzy(base, { ...base, surface: 126 })).toBe(false);
  });

  it("matches when surface is missing on one side", () => {
    expect(propertiesMatchFuzzy(base, { ...base, surface: null })).toBe(true);
  });

  it("matches house and Maison property types", () => {
    expect(propertiesMatchFuzzy(base, { ...base, propertyType: "house" })).toBe(
      true
    );
  });

  it("matches when rooms or bedrooms are missing on one side", () => {
    expect(propertiesMatchFuzzy(base, { ...base, rooms: null })).toBe(true);
    expect(propertiesMatchFuzzy(base, { ...base, bedrooms: null })).toBe(true);
    expect(
      propertiesMatchFuzzy(base, { ...base, rooms: null, bedrooms: null })
    ).toBe(true);
  });

  it("matches when property type is missing on one side", () => {
    expect(propertiesMatchFuzzy(base, { ...base, propertyType: null })).toBe(
      true
    );
  });

  it("matches pavillon and propriété with maison", () => {
    expect(
      propertiesMatchFuzzy(base, { ...base, propertyType: "Pavillon" })
    ).toBe(true);
    expect(
      propertiesMatchFuzzy(base, { ...base, propertyType: "Propriété" })
    ).toBe(true);
  });
});
