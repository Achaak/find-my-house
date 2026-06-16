import { describe, expect, it } from "vitest";
import { makeListing } from "../test/listingFixtures.js";
import { DefaultPropertyMatchPolicy } from "./propertyMatchPolicy.js";

describe("DefaultPropertyMatchPolicy", () => {
  const policy = new DefaultPropertyMatchPolicy();

  it("finds a pending match within current scrape batch", () => {
    const first = makeListing({
      source: "leboncoin",
      externalId: "policy-lbc-1",
      postalCode: "76400",
      price: 292_000,
      surface: 150,
      rooms: 7,
      bedrooms: 5,
      landSurface: 1500,
      propertyType: "Maison",
      isNewProperty: false,
    });
    const second = makeListing({
      source: "logicimmo",
      externalId: "policy-limmo-1",
      postalCode: "76400",
      price: 292_000,
      surface: 150,
      rooms: null,
      bedrooms: null,
      landSurface: 1500,
      propertyType: null,
      isNewProperty: null,
    });

    const match = policy.findPendingMatch(second, [
      { listing: first, scrapedAt: new Date(), extraPublications: [] },
    ]);

    expect(match?.listing.externalId).toBe("policy-lbc-1");
  });

  it("finds a candidate match with agency-aware bienici rule", () => {
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

    const match = policy.findCandidateMatch(listing, [
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

  it("collects diagnostics with best score and near misses", () => {
    const listing = makeListing({
      source: "leboncoin",
      externalId: "policy-diag",
      postalCode: "76170",
      price: 200_000,
      surface: 100,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1000,
      propertyType: "Maison",
      isNewProperty: false,
    });

    const diagnostics = policy.collectDiagnostics(listing, [
      {
        id: 1,
        postalCode: "76170",
        price: 200_000,
        surface: 100,
        rooms: 5,
        bedrooms: 3,
        landSurface: 1000,
        propertyType: "Maison",
        isNewProperty: false,
      },
      {
        id: 2,
        postalCode: "76170",
        price: 210_000,
        surface: 100,
        rooms: 5,
        bedrooms: 3,
        landSurface: 1000,
        propertyType: "Maison",
        isNewProperty: false,
      },
    ]);

    expect(diagnostics.threshold).toBe(0.85);
    expect(diagnostics.bestCandidateId).toBe(1);
    expect(diagnostics.bestScore).toBe(1);
    expect(diagnostics.bestVeto).toBeNull();
    expect(diagnostics.nearMisses.length).toBeGreaterThanOrEqual(0);
  });
});
