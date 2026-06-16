import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import {
  hasPropertyScalarChanges,
  PROPERTY_COMPARABLE_FIELDS,
  toPropertyScalarData,
} from "./propertyFieldManifest.js";

describe("propertyFieldManifest", () => {
  it("extracts a stable comparable scalar view from Listing", () => {
    const listing = makeListing({
      title: "Manifest home",
      price: 321_000,
      highlights: ["garage", "jardin"],
    });

    const scalars = toPropertyScalarData(listing);

    expect(Object.keys(scalars).sort()).toEqual(
      [...PROPERTY_COMPARABLE_FIELDS].sort()
    );
    expect(scalars.title).toBe("Manifest home");
    expect(scalars.price).toBe(321_000);
    expect(scalars.highlights).toEqual(["garage", "jardin"]);
  });

  it("detects scalar changes and ignores highlight ordering", () => {
    const listing = makeListing({ highlights: ["garage", "jardin"] });
    const existing = toPropertyScalarData(listing);

    const reorderedHighlights = {
      ...listing,
      highlights: ["jardin", "garage"],
    };
    const changedPrice = { ...listing, price: listing.price + 10_000 };

    expect(hasPropertyScalarChanges(existing, reorderedHighlights)).toBe(false);
    expect(hasPropertyScalarChanges(existing, changedPrice)).toBe(true);
  });
});
