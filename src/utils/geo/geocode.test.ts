import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGeoSearchCenterCache,
  resolveGeoSearchCenter,
} from "./geocode.js";

vi.mock("../bienici/place.js", () => ({
  resolveBienIciPlace: vi.fn(),
  resolveBienIciTravelOrigin: vi.fn(),
}));

import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../bienici/place.js";

const mockedResolvePlace = vi.mocked(resolveBienIciPlace);
const mockedResolveTravelOrigin = vi.mocked(resolveBienIciTravelOrigin);

describe("resolveGeoSearchCenter", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearGeoSearchCenterCache();
  });

  it("returns null when the city cannot be resolved", async () => {
    mockedResolvePlace.mockResolvedValue(null);

    await expect(resolveGeoSearchCenter("Unknown")).resolves.toBeNull();
  });

  it("uses the travel origin center when available", async () => {
    mockedResolvePlace.mockResolvedValue({
      name: "Lanquetot (76160)",
      center: { lat: 49.6, lng: 0.5 },
      postalCodes: ["76160"],
    });
    mockedResolveTravelOrigin.mockResolvedValue({
      center: { lat: 49.61, lng: 0.51 },
      address: "Lanquetot",
    });

    await expect(resolveGeoSearchCenter("Lanquetot", "76160")).resolves.toEqual(
      {
        center: { lat: 49.61, lng: 0.51 },
        placeName: "Lanquetot (76160)",
        zipcode: "76160",
      }
    );
  });

  it("falls back to the place center and extracts zipcode from the label", async () => {
    mockedResolvePlace.mockResolvedValue({
      name: "Paris (75001)",
      center: { lat: 48.8566, lng: 2.3522 },
      postalCodes: [],
    });
    mockedResolveTravelOrigin.mockResolvedValue(null);

    await expect(resolveGeoSearchCenter("Paris")).resolves.toEqual({
      center: { lat: 48.8566, lng: 2.3522 },
      placeName: "Paris (75001)",
      zipcode: "75001",
    });
  });
});
