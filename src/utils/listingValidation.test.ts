import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import { validateListing, validateListings } from "./listingValidation.js";

describe("listingValidation", () => {
  it("accepts a well-formed listing", () => {
    expect(validateListing(makeListing())).toEqual(makeListing());
  });

  it("rejects listings with invalid price", () => {
    expect(
      validateListing(makeListing({ price: 0, externalId: "invalid-price" }))
    ).toBeNull();
  });

  it("filters invalid listings from a batch", () => {
    const valid = makeListing({
      externalId: "valid-1",
      url: "https://www.bienici.com/annonce/valid-1",
    });
    const invalid = makeListing({
      externalId: "",
      url: "https://www.bienici.com/annonce/invalid",
    });

    expect(validateListings([valid, invalid])).toEqual([valid]);
  });
});
