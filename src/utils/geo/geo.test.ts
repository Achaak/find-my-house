import { describe, expect, it } from "vitest";
import {
  boundingBoxForRadiusKm,
  haversineDistanceKm,
  isWithinRadiusKm,
} from "./geo.js";

describe("boundingBoxForRadiusKm", () => {
  it("contains points inside the radius and excludes distant points", () => {
    const center = { lat: 48.8566, lng: 2.3522 };
    const bounds = boundingBoxForRadiusKm(center, 10);

    expect(bounds.minLat).toBeLessThan(center.lat);
    expect(bounds.maxLat).toBeGreaterThan(center.lat);
    expect(bounds.minLng).toBeLessThan(center.lng);
    expect(bounds.maxLng).toBeGreaterThan(center.lng);

    const nearby = { lat: 48.87, lng: 2.33 };
    const far = { lat: 49.5, lng: 2.35 };

    expect(nearby.lat).toBeGreaterThanOrEqual(bounds.minLat);
    expect(nearby.lat).toBeLessThanOrEqual(bounds.maxLat);
    expect(nearby.lng).toBeGreaterThanOrEqual(bounds.minLng);
    expect(nearby.lng).toBeLessThanOrEqual(bounds.maxLng);
    expect(isWithinRadiusKm(nearby, center, 10)).toBe(true);
    expect(isWithinRadiusKm(far, center, 10)).toBe(false);
    expect(
      haversineDistanceKm(center.lat, center.lng, far.lat, far.lng)
    ).toBeGreaterThan(10);
  });
});
