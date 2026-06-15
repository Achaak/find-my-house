import { describe, expect, it } from "vitest";
import { scrapeFiltersToSearch } from "./scrapeFilters.js";

describe("scrapeFiltersToSearch", () => {
  it("maps scrape defaults to listing search filters", () => {
    expect(
      scrapeFiltersToSearch({
        city: "Lanquetot",
        postalCode: "76160",
        maxPrice: 400_000,
        minSurface: 80,
        minLandSurface: 300,
        minRooms: 4,
        minBedrooms: 2,
        ancienOnly: true,
        maxTravelMinutes: 45,
      })
    ).toEqual({
      city: "Lanquetot",
      postalCode: "76160",
      maxPrice: 400_000,
      minSurface: 80,
      minLandSurface: 300,
      minRooms: 4,
      minBedrooms: 2,
      ancienOnly: true,
      maxTravelMinutes: 45,
    });
  });
});
