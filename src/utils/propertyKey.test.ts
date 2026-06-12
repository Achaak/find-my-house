import { describe, expect, it } from "vitest";
import { computePropertyKey } from "./propertyKey.js";

const base = {
  postalCode: "75001",
  price: 300_000,
  surface: 90,
  rooms: 5,
  bedrooms: 3,
  landSurface: 500,
  propertyType: "house",
  isNewProperty: false,
};

describe("computePropertyKey", () => {
  it("returns a stable 32-char hex key for the same attributes", () => {
    expect(computePropertyKey(base)).toBe(computePropertyKey(base));
    expect(computePropertyKey(base)).toMatch(/^[a-f0-9]{32}$/);
  });

  it("matches across portals when structural attributes align", () => {
    const bienici = {
      postalCode: "69001",
      price: 450_000,
      surface: 120.4,
      rooms: 6,
      bedrooms: 4,
      landSurface: 800,
      propertyType: "Maison",
      isNewProperty: false,
    };
    const leboncoin = { ...bienici, propertyType: "maison" };
    const bieniciApi = { ...bienici, propertyType: "house" };

    expect(computePropertyKey(bienici)).toBe(computePropertyKey(leboncoin));
    expect(computePropertyKey(bienici)).toBe(computePropertyKey(bieniciApi));
  });

  it("changes when price, surface, or property type differs", () => {
    expect(computePropertyKey({ ...base, price: 299_000 })).not.toBe(
      computePropertyKey(base)
    );
    expect(computePropertyKey({ ...base, surface: 91 })).not.toBe(
      computePropertyKey(base)
    );
    expect(computePropertyKey({ ...base, propertyType: "apartment" })).not.toBe(
      computePropertyKey(base)
    );
  });

  it("separates properties with different land surface or new/ancien flag", () => {
    expect(computePropertyKey({ ...base, landSurface: 600 })).not.toBe(
      computePropertyKey(base)
    );
    expect(computePropertyKey({ ...base, isNewProperty: true })).not.toBe(
      computePropertyKey(base)
    );
  });

  it("normalizes surface to one decimal place", () => {
    const a = { ...base, surface: 90.01 };
    const b = { ...base, surface: 90.04 };

    expect(computePropertyKey(a)).toBe(computePropertyKey(b));
  });
});
