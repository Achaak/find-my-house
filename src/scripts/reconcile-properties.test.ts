import { describe, expect, it } from "vitest";
import { computePropertyKey } from "../utils/propertyKey.js";

describe("reconcile-properties grouping", () => {
  it("groups properties with the same dedup key", () => {
    const base = {
      postalCode: "75001",
      price: 420_000,
      surface: 110,
      rooms: 6,
      bedrooms: 4,
    };

    const keyA = computePropertyKey(base);
    const keyB = computePropertyKey({
      ...base,
      price: 420_000,
      surface: 110.04,
    });

    expect(keyA).toBe(keyB);
    expect(keyA).not.toBe(computePropertyKey({ ...base, price: 425_000 }));
  });
});
