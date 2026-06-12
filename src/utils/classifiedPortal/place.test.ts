import { describe, expect, it } from "vitest";
import { travelTimeRadiusKm } from "../geo/geoFilter.js";
import {
  buildClassifiedRadiusLocation,
  buildClassifiedTravelLocation,
  resolveClassifiedLocation,
} from "./place.js";
import type { ClassifiedPlace } from "./types.js";

const samplePlace: ClassifiedPlace = {
  name: "Villeexemple",
  center: { lat: 48.5, lng: 2.3 },
  locationCode: "AD08FR12345",
};

describe("resolveClassifiedLocation", () => {
  it("uses STRT travel-time encoding when a start point is available", () => {
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "travel", maxTravelMinutes: 40 },
      {
        strtPlaceId: "STRTFR123",
        origin: { lat: 48.51, lng: 2.31 },
      }
    );

    expect(location).toBe(buildClassifiedTravelLocation("STRTFR123", 40));
  });

  it("falls back to server-side radius search when STRT is missing", () => {
    const origin = { lat: 48.51, lng: 2.31 };
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "travel", maxTravelMinutes: 40 },
      {
        strtPlaceId: null,
        origin,
      }
    );

    expect(location).toBe(
      buildClassifiedRadiusLocation(samplePlace, travelTimeRadiusKm(40), origin)
    );
  });

  it("uses server-side radius search for explicit radius filters", () => {
    const origin = { lat: 48.51, lng: 2.31 };
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "radius", radiusKm: 20 },
      {
        strtPlaceId: null,
        origin,
      }
    );

    expect(location).toBe(
      buildClassifiedRadiusLocation(samplePlace, 20, origin)
    );
  });

  it("keeps city-only search unchanged", () => {
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "city" },
      {
        strtPlaceId: null,
        origin: samplePlace.center,
      }
    );

    expect(location).toBe("AD08FR12345");
  });
});
