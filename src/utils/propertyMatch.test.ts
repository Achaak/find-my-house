import { describe, expect, it } from "vitest";
import { propertiesMatchFuzzy } from "./propertyMatch.js";

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
