import { describe, expect, it } from "vitest";
import {
  buildLeboncoinAreaLocation,
  type LeboncoinPlace,
} from "./leboncoinApi.js";
import { travelTimeRadiusKm } from "./geoFilter.js";

const parisPlace: LeboncoinPlace = {
  name: "Paris (75000)",
  center: { lat: 48.856614, lng: 2.3522219 },
  location: {
    locationType: "city",
    label: "Paris (75000)",
    city: "Paris",
    zipcode: "75000",
    department_id: "75",
    region_id: "12",
    area: {
      lat: 48.856614,
      lng: 2.3522219,
      default_radius: 5000,
    },
  },
};

describe("buildLeboncoinAreaLocation", () => {
  it("rounds radius to whole meters for the API", () => {
    const radiusKm = travelTimeRadiusKm(40);
    const location = buildLeboncoinAreaLocation(parisPlace, radiusKm);

    expect(location.area?.radius).toBe(Math.round(radiusKm * 1000));
    expect(Number.isInteger(location.area?.radius)).toBe(true);
  });
});
