import { describe, expect, it } from "vitest";
import { computePropertyKey } from "./propertyKey.js";

describe("computePropertyKey", () => {
  it("returns a stable 32-char hex key for the same attributes", () => {
    const listing = {
      postalCode: "75001",
      price: 300_000,
      surface: 90,
      rooms: 5,
      bedrooms: 3,
    };

    expect(computePropertyKey(listing)).toBe(computePropertyKey(listing));
    expect(computePropertyKey(listing)).toMatch(/^[a-f0-9]{32}$/);
  });

  it("matches across portals when structural attributes align", () => {
    const bienici = {
      postalCode: "69001",
      price: 450_000,
      surface: 120.4,
      rooms: 6,
      bedrooms: 4,
    };
    const leboncoin = { ...bienici };

    expect(computePropertyKey(bienici)).toBe(computePropertyKey(leboncoin));
  });

  it("changes when price or surface differs", () => {
    const base = {
      postalCode: "75001",
      price: 300_000,
      surface: 90,
      rooms: 5,
      bedrooms: 3,
    };

    expect(computePropertyKey({ ...base, price: 299_000 })).not.toBe(
      computePropertyKey(base)
    );
    expect(computePropertyKey({ ...base, surface: 91 })).not.toBe(
      computePropertyKey(base)
    );
  });

  it("normalizes surface to one decimal place", () => {
    const a = {
      postalCode: "75001",
      price: 300_000,
      surface: 90.01,
      rooms: 5,
      bedrooms: 3,
    };
    const b = { ...a, surface: 90.04 };

    expect(computePropertyKey(a)).toBe(computePropertyKey(b));
  });
});
