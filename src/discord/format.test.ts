import { describe, expect, it } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import { formatPrice, formatPriceDrop } from "./format.js";

describe("discord/format", () => {
  it("formats prices in EUR without decimals", () => {
    expect(formatPrice(300_000)).toContain("300");
    expect(formatPrice(300_000)).toContain("€");
  });

  it("describes a price drop from first price", () => {
    const property = makePropertyRow({
      price: 280_000,
      firstPrice: 300_000,
    });

    const label = formatPriceDrop(property);
    expect(label).toContain("Baisse de prix");
    expect(label).toContain("280");
    expect(label).toContain("300");
  });

  it("returns null when price did not drop", () => {
    expect(
      formatPriceDrop(makePropertyRow({ price: 300_000, firstPrice: 300_000 }))
    ).toBeNull();
  });
});
