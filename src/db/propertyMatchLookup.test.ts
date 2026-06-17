import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import {
  findAgencyPropertyMatch,
  findFuzzyPropertyMatch,
  findPendingPropertyMatch,
} from "./propertyMatchLookup.js";

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

describe("findPendingPropertyMatch", () => {
  it("matches listings queued for creation in the same scrape batch", () => {
    const leboncoin = makeListing({
      source: "leboncoin",
      externalId: "lbc-1",
      postalCode: "76400",
      price: 292_000,
      surface: 150,
      rooms: 7,
      bedrooms: 5,
      landSurface: 1500,
      propertyType: "Maison",
      isNewProperty: false,
    });
    const logicimmo = makeListing({
      source: "logicimmo",
      externalId: "limmo-1",
      postalCode: "76400",
      price: 292_000,
      surface: 150,
      rooms: null,
      bedrooms: null,
      landSurface: 1500,
      propertyType: null,
      isNewProperty: null,
    });

    const match = findPendingPropertyMatch(logicimmo, [
      { listing: leboncoin, scrapedAt: new Date(), extraPublications: [] },
    ]);

    expect(match?.listing.externalId).toBe("lbc-1");
  });

  it("matches a listing to a candidate via publication fields", () => {
    const leboncoin = makeListing({
      source: "leboncoin",
      externalId: "lbc-475",
      postalCode: "76450",
      price: 197_000,
      surface: 130,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1000,
      propertyType: "Maison",
      isNewProperty: false,
    });

    const match = findFuzzyPropertyMatch(leboncoin, [
      {
        id: 780,
        postalCode: "76450",
        price: 197_000,
        surface: 130,
        rooms: 5,
        bedrooms: 3,
        landSurface: 1000,
        propertyType: "Maison",
        isNewProperty: true,
        publications: [
          {
            postalCode: "76450",
            price: 197_000,
            surface: 130,
            rooms: 5,
            bedrooms: 3,
            landSurface: 1000,
            propertyType: "Maison",
            isNewProperty: true,
            source: "seloger",
          },
        ],
      },
    ]);

    expect(match?.id).toBe(780);
  });
});
