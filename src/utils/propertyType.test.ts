import { describe, expect, it } from "vitest";
import { canonicalPropertyType } from "./propertyType.js";
import { computePropertyKey } from "./propertyKey.js";

describe("canonicalPropertyType", () => {
  it("maps cross-language house synonyms", () => {
    expect(canonicalPropertyType("house")).toBe("house");
    expect(canonicalPropertyType("Maison")).toBe("house");
    expect(canonicalPropertyType("maison")).toBe("house");
  });

  it("maps cross-language apartment synonyms", () => {
    expect(canonicalPropertyType("flat")).toBe("apartment");
    expect(canonicalPropertyType("apartment")).toBe("apartment");
    expect(canonicalPropertyType("Appartement")).toBe("apartment");
  });

  it("keeps distinct property types separate", () => {
    expect(canonicalPropertyType("villa")).toBe("villa");
    expect(canonicalPropertyType("townhouse")).toBe("townhouse");
    expect(canonicalPropertyType("Maison de ville")).toBe("townhouse");
  });
});

describe("computePropertyKey with canonical property types", () => {
  const base = {
    postalCode: "76170",
    price: 195_500,
    surface: 125,
    rooms: 5,
    bedrooms: 3,
    landSurface: 1509,
    isNewProperty: false,
  };

  it("matches Bienici house with French Maison listings", () => {
    expect(computePropertyKey({ ...base, propertyType: "house" })).toBe(
      computePropertyKey({ ...base, propertyType: "Maison" })
    );
  });
});
