import { describe, expect, it } from "vitest";
import {
  geoFilterLabel,
  resolveGeoFilter,
  resolveRadiusSearchFilter,
  resolveScraperGeoFilter,
  travelTimeRadiusKm,
} from "./geoFilter.js";

describe("resolveGeoFilter", () => {
  it("uses travel time when set and supported", () => {
    expect(resolveGeoFilter({ maxTravelMinutes: 30 }, true)).toEqual({
      mode: "travel",
      maxTravelMinutes: 30,
    });
  });

  it("returns city mode when travel time is unsupported", () => {
    expect(resolveGeoFilter({ maxTravelMinutes: 30 }, false)).toEqual({
      mode: "city",
    });
  });

  it("returns city mode when no geo constraint is set", () => {
    expect(resolveGeoFilter({}, true)).toEqual({ mode: "city" });
  });
});

describe("resolveScraperGeoFilter", () => {
  it("converts travel time to estimated radius for Leboncoin", () => {
    expect(resolveScraperGeoFilter({ maxTravelMinutes: 30 }, false)).toEqual({
      mode: "radius",
      radiusKm: travelTimeRadiusKm(30),
    });
  });
});

describe("resolveRadiusSearchFilter", () => {
  const center = { lat: 48.8566, lng: 2.3522 };

  it("maps travel mode to a driving radius", () => {
    expect(
      resolveRadiusSearchFilter(
        { mode: "travel", maxTravelMinutes: 30 },
        center
      )
    ).toEqual({
      center,
      radiusKm: travelTimeRadiusKm(30),
    });
  });

  it("returns null for city mode", () => {
    expect(resolveRadiusSearchFilter({ mode: "city" }, center)).toBeNull();
  });
});

describe("geoFilterLabel", () => {
  it("formats travel and radius labels", () => {
    expect(geoFilterLabel({ mode: "travel", maxTravelMinutes: 25 })).toBe(
      "25 min drive"
    );
    expect(geoFilterLabel({ mode: "radius", radiusKm: 15 })).toBe(
      "15 km radius"
    );
  });
});
