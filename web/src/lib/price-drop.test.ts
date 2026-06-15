import { describe, expect, it } from "vitest";
import { formatPriceDrop, hasPriceDrop } from "./price-drop";

describe("hasPriceDrop", () => {
  it("returns true when price is below firstPrice", () => {
    expect(hasPriceDrop({ price: 350_000, firstPrice: 400_000 })).toBe(true);
  });

  it("returns false when price equals firstPrice", () => {
    expect(hasPriceDrop({ price: 400_000, firstPrice: 400_000 })).toBe(false);
  });
});

describe("formatPriceDrop", () => {
  it("formats the drop amount and percentage", () => {
    expect(formatPriceDrop({ price: 360_000, firstPrice: 400_000 })).toMatch(
      /−40\s000/
    );
  });

  it("returns null when there is no drop", () => {
    expect(formatPriceDrop({ price: 400_000, firstPrice: 400_000 })).toBeNull();
  });
});
