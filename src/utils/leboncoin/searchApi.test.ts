import { describe, expect, it } from "vitest";
import { travelTimeRadiusKm } from "../geo/geoFilter.js";
import { buildLeboncoinAreaLocation, type LeboncoinPlace } from "./client.js";
import {
  buildLeboncoinSearchRequest,
  parseLeboncoinSearchResponse,
} from "./searchApi.js";

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

describe("buildLeboncoinSearchRequest", () => {
  it("builds a radius search request for the finder API", () => {
    const location = buildLeboncoinAreaLocation(
      lyonPlace,
      travelTimeRadiusKm(40)
    );
    const request = buildLeboncoinSearchRequest(
      {
        maxPrice: 300_000,
        minSurface: 90,
        minRooms: 4,
        minBedrooms: 3,
        ancienOnly: true,
      },
      location,
      2
    );

    expect(request.offset).toBe(35);
    expect(request.filters.category.id).toBe("9");
    expect(request.filters.enums.real_estate_type).toEqual(["1"]);
    expect(request.filters.enums.immo_sell_type).toEqual(["old"]);
    expect(request.filters.ranges.price).toEqual({ min: 0, max: 300_000 });
    expect(request.filters.location).toEqual({
      area: {
        lat: 45.75,
        lng: 4.85,
        radius: Math.round(travelTimeRadiusKm(40) * 1000),
      },
    });
  });

  it("uses keywords when no radius is available", () => {
    const request = buildLeboncoinSearchRequest(
      { maxPrice: 300_000 },
      {
        locationType: "city",
        label: "Lyon",
        city: "Lyon",
      },
      1
    );

    expect(request.filters.keywords).toEqual({ text: "Lyon" });
    expect(request.filters.location).toBeUndefined();
  });
});

describe("parseLeboncoinSearchResponse", () => {
  it("normalizes API pagination fields", () => {
    const parsed = parseLeboncoinSearchResponse({
      total: 12,
      max_pages: 3,
      ads: [],
    });

    expect(parsed.totalCount).toBe(12);
    expect(parsed.maxPages).toBe(3);
  });
});
