import { describe, expect, it } from "vitest";
import {
  filtersToSearchParams,
  normalizeListingFilters,
  searchParamsToFilters,
} from "./listing-filters";

describe("filtersToSearchParams", () => {
  it("serializes defined filter values", () => {
    expect(
      filtersToSearchParams({
        city: "Lyon",
        minPrice: 200_000,
        priceDropOnly: true,
      })
    ).toEqual({
      city: "Lyon",
      minPrice: "200000",
      priceDropOnly: "true",
    });
  });
});

describe("searchParamsToFilters", () => {
  it("parses listing search filters from route search params", () => {
    expect(
      searchParamsToFilters({
        city: " Paris ",
        minSurface: "90",
        priceDropOnly: "true",
        sort: "price_asc",
      })
    ).toEqual({
      city: "Paris",
      postalCode: undefined,
      text: undefined,
      source: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minSurface: 90,
      minLandSurface: undefined,
      minRooms: undefined,
      minBedrooms: undefined,
      maxTravelMinutes: undefined,
      ancienOnly: undefined,
      neufOnly: undefined,
      priceDropOnly: true,
      sort: "price_asc",
      limit: 20,
    });
  });
});

describe("normalizeListingFilters", () => {
  it("drops empty strings and false flags", () => {
    expect(
      normalizeListingFilters({
        city: "  ",
        postalCode: "69001",
        priceDropOnly: false,
        limit: 20,
      })
    ).toEqual({
      city: undefined,
      postalCode: "69001",
      text: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minSurface: undefined,
      minLandSurface: undefined,
      minRooms: undefined,
      minBedrooms: undefined,
      maxTravelMinutes: undefined,
      ancienOnly: undefined,
      neufOnly: undefined,
      priceDropOnly: undefined,
      limit: 20,
    });
  });
});
