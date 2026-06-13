import { describe, expect, it } from "vitest";
import { travelTimeRadiusKm } from "../geo/geoFilter.js";
import { buildLeboncoinAreaLocation, type LeboncoinPlace } from "./client.js";
import {
  buildLeboncoinSearchUrl,
  encodeLeboncoinWebLocation,
} from "./searchUrl.js";

const lyonPlace: LeboncoinPlace = {
  name: "Lyon",
  center: { lat: 45.75, lng: 4.85 },
  location: {
    locationType: "city",
    label: "Lyon",
    city: "Lyon",
    zipcode: "69001",
    area: {
      lat: 45.75,
      lng: 4.85,
      default_radius: 5000,
    },
  },
};

describe("buildLeboncoinAreaLocation", () => {
  it("rounds radius to whole meters for search URLs", () => {
    const radiusKm = travelTimeRadiusKm(40);
    const location = buildLeboncoinAreaLocation(lyonPlace, radiusKm);

    expect(location.area?.radius).toBe(Math.round(radiusKm * 1000));
    expect(Number.isInteger(location.area?.radius)).toBe(true);
  });
});

describe("encodeLeboncoinWebLocation", () => {
  it("returns null when area search has no postal code", () => {
    const location = buildLeboncoinAreaLocation(
      {
        ...lyonPlace,
        location: { ...lyonPlace.location, zipcode: undefined },
      },
      20
    );

    expect(encodeLeboncoinWebLocation(location)).toBeNull();
  });

  it("includes postal code in the locations token", () => {
    const location = buildLeboncoinAreaLocation(lyonPlace, 20);

    expect(encodeLeboncoinWebLocation(location)).toBe(
      "Lyon_69001__45.75_4.85_20000"
    );
  });
});

describe("buildLeboncoinSearchUrl", () => {
  it("builds a ventes immobilières search URL with filters", () => {
    const radiusKm = travelTimeRadiusKm(40);
    const location = buildLeboncoinAreaLocation(lyonPlace, radiusKm);
    const url = buildLeboncoinSearchUrl(
      {
        maxPrice: 300_000,
        minSurface: 90,
        minLandSurface: 1000,
        minRooms: 4,
        minBedrooms: 3,
        ancienOnly: true,
      },
      location
    );

    expect(url).toContain("https://www.leboncoin.fr/recherche?");
    expect(url).toContain("category=9");
    expect(url).toContain("real_estate_type=1");
    expect(url).toContain("locations=Lyon_69001__");
    expect(url).toContain("price=0-300000");
    expect(url).toContain("square=90-max");
    expect(url).toContain("immo_sell_type=old");
  });

  it("falls back to text search when postal code is missing", () => {
    const location = buildLeboncoinAreaLocation(
      {
        ...lyonPlace,
        location: { ...lyonPlace.location, zipcode: undefined },
      },
      20
    );
    const url = buildLeboncoinSearchUrl({ maxPrice: 300_000 }, location);

    expect(url).toContain("text=Lyon");
    expect(url).not.toContain("locations=");
  });

  it("can force text search mode even with a valid area location", () => {
    const location = buildLeboncoinAreaLocation(lyonPlace, 20);
    const url = buildLeboncoinSearchUrl(
      { maxPrice: 300_000 },
      location,
      1,
      "text"
    );

    expect(url).toContain("text=Lyon");
    expect(url).not.toContain("locations=");
  });
});
