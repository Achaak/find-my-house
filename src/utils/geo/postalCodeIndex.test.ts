import { describe, expect, it } from "vitest";
import { buildPostalCodeIndex } from "./postalCodeIndex.js";

describe("buildPostalCodeIndex", () => {
  it("indexes postal codes from commune centroids", () => {
    const index = buildPostalCodeIndex([
      {
        nom: "Fécamp",
        codesPostaux: ["76400"],
        centre: { coordinates: [0.378, 49.758] },
      },
    ]);

    expect(index["76400"]).toEqual({
      lat: 49.758,
      lng: 0.378,
      city: "Fécamp",
    });
  });

  it("stores multiple communes for the same postal code", () => {
    const index = buildPostalCodeIndex([
      {
        nom: "Ambérieu-en-Bugey",
        codesPostaux: ["01500"],
        centre: { coordinates: [5.3706, 45.9575] },
      },
      {
        nom: "Ambronay",
        codesPostaux: ["01500"],
        centre: { coordinates: [5.3627, 46.0099] },
      },
    ]);

    expect(Array.isArray(index["01500"])).toBe(true);
    expect(index["01500"]).toHaveLength(2);
  });
});
