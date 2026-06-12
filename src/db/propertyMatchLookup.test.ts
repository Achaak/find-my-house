import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import { findAgencyPropertyMatch } from "./propertyMatchLookup.js";

describe("findAgencyPropertyMatch", () => {
  it("matches a new Bienici listing to a property from the same agency", () => {
    const listing = makeListing({
      source: "bienici",
      externalId: "iad-france-999999",
      postalCode: "76170",
      price: 195_500,
      surface: 125,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1509,
      propertyType: "house",
      isNewProperty: false,
    });

    const match = findAgencyPropertyMatch(listing, [
      {
        id: 42,
        postalCode: "76170",
        price: 195_500,
        surface: 125,
        rooms: 5,
        bedrooms: 3,
        landSurface: 1509,
        propertyType: "Maison",
        isNewProperty: false,
        publications: [
          {
            source: "bienici",
            agencySlug: "iad-france",
            agencyRef: "123456",
          },
        ],
      },
    ]);

    expect(match?.id).toBe(42);
  });
});
