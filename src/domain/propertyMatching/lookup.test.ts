import { describe, expect, it } from "vitest";
import { makeListing } from "../../test/listingFixtures.js";
import {
  findAgencyPropertyMatch,
  findFuzzyPropertyMatch,
  findPendingPropertyMatch,
} from "./lookup.js";

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

  it("matches pending Bienici listings via agency slug", () => {
    const first = makeListing({
      source: "bienici",
      externalId: "iad-france-111",
      postalCode: "76170",
      price: 195_500,
      surface: 125,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1509,
      propertyType: "house",
      isNewProperty: false,
    });
    const second = makeListing({
      source: "bienici",
      externalId: "iad-france-222",
      postalCode: "76170",
      price: 195_500,
      surface: 125,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1509,
      propertyType: "house",
      isNewProperty: false,
    });

    const match = findPendingPropertyMatch(second, [
      { listing: first, scrapedAt: new Date(), extraPublications: [] },
    ]);

    expect(match?.listing.externalId).toBe("iad-france-111");
  });
});

describe("findFuzzyPropertyMatch", () => {
  it("matches across portals when structural fields agree", () => {
    const listing = makeListing({
      source: "leboncoin",
      externalId: "lbc-fuzzy",
      postalCode: "76400",
      price: 292_000,
      surface: 150,
      rooms: 7,
      bedrooms: 5,
      landSurface: 1500,
      propertyType: "Maison",
      isNewProperty: false,
    });

    const match = findFuzzyPropertyMatch(listing, [
      {
        id: 7,
        postalCode: "76400",
        price: 292_000,
        surface: 150,
        rooms: 7,
        bedrooms: 5,
        landSurface: 1500,
        propertyType: "Maison",
        isNewProperty: false,
        publications: [],
      },
    ]);

    expect(match?.id).toBe(7);
  });
});
