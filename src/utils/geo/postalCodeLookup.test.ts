import { describe, expect, it, beforeEach } from "vitest";
import {
  clearPostalCodeIndexCache,
  lookupPostalCodeCoords,
  lookupPostalCodeEntry,
} from "./postalCodeLookup.js";

describe("postalCodeLookup", () => {
  beforeEach(() => {
    clearPostalCodeIndexCache();
  });

  it("resolves a postal code", () => {
    const entry = lookupPostalCodeEntry("76400", "Fécamp");
    expect(entry?.city).toBe("Fécamp");
    if (!entry) throw new Error("Expected postal code entry");
    expect(lookupPostalCodeCoords("76400", "Fécamp")).toEqual({
      lat: entry.lat,
      lng: entry.lng,
    });
  });

  it("disambiguates shared postal codes with the city label", () => {
    const entry = lookupPostalCodeEntry("01500", "Ambérieu-en-Bugey");
    expect(entry?.city).toBe("Ambérieu-en-Bugey");
  });

  it("returns null for invalid postal codes", () => {
    expect(lookupPostalCodeEntry("7640")).toBeNull();
    expect(lookupPostalCodeEntry("")).toBeNull();
  });
});
