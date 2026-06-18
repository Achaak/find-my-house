import { describe, expect, it } from "vitest";
import { travelTimeRadiusKm } from "../geo/geoFilter.js";
import {
  buildClassifiedRadiusLocation,
  buildClassifiedSeoSearchUrl,
  buildClassifiedTravelLocation,
  ceilClassifiedTravelMinutes,
  departmentFromClassifiedLocationCode,
  resolveClassifiedLocation,
} from "./place.js";
import { SELOGER_PORTAL } from "./config.js";
import type { ClassifiedPlace } from "./types.js";

const samplePlace: ClassifiedPlace = {
  name: "Villeexemple",
  center: { lat: 48.5, lng: 2.3 },
  locationCode: "AD08FR12345",
};

function decodeTravelDuration(encoded: string): string {
  const parsed: unknown = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  );
  if (!parsed || typeof parsed !== "object" || !("duration" in parsed)) {
    throw new Error("Missing duration in encoded location");
  }
  const duration = parsed.duration;
  if (typeof duration !== "string") {
    throw new Error("Invalid duration in encoded location");
  }
  return duration;
}

describe("resolveClassifiedLocation", () => {
  it("uses STRT isochrone when the duration matches a portal tier", () => {
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "travel", maxTravelMinutes: 30 },
      {
        strtPlaceId: "STRTFR123",
        origin: { lat: 48.51, lng: 2.31 },
      }
    );

    expect(location).toBe(buildClassifiedTravelLocation("STRTFR123", 30));
  });

  it("uses the next isochrone tier for intermediate travel durations", () => {
    const origin = { lat: 48.51, lng: 2.31 };
    const location = resolveClassifiedLocation(
      samplePlace,
      { mode: "travel", maxTravelMinutes: 40 },
      {
        strtPlaceId: "STRTFR123",
        origin,
      }
    );

    expect(location).toBe(buildClassifiedTravelLocation("STRTFR123", 40));
  });

  it("ceil unsupported travel durations to the next SeLoger option for isochrone encoding", () => {
    expect(ceilClassifiedTravelMinutes(40)).toBe(45);
    expect(ceilClassifiedTravelMinutes(32)).toBe(45);
    expect(ceilClassifiedTravelMinutes(30)).toBe(30);
    expect(ceilClassifiedTravelMinutes(61)).toBe(60);

    const encoded = buildClassifiedTravelLocation("STRTFR123", 40);
    expect(decodeTravelDuration(encoded)).toBe("45");
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

describe("buildClassifiedSeoSearchUrl", () => {
  it("builds SeLoger SEO listing URLs with pagination", () => {
    const place: ClassifiedPlace = {
      name: "Villeexemple",
      center: { lat: 48.5, lng: 2.3 },
      locationCode: "AD08FR12345",
    };

    expect(buildClassifiedSeoSearchUrl(SELOGER_PORTAL, place)).toBe(
      "https://www.seloger.com/immobilier/achat/immo-villeexemple-12/bien-maison/"
    );
    expect(buildClassifiedSeoSearchUrl(SELOGER_PORTAL, place, 2)).toBe(
      "https://www.seloger.com/immobilier/achat/immo-villeexemple-12/bien-maison/?LISTING-LISTpg=2"
    );
    expect(departmentFromClassifiedLocationCode("AD08FR12345")).toBe("12");
  });
});
