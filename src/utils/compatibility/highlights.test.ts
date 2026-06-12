import { describe, expect, it } from "vitest";
import { collectPreferredHighlights } from "./highlights.js";

describe("collectPreferredHighlights", () => {
  it("keeps highlights shared across liked listings", () => {
    expect(
      collectPreferredHighlights([
        { highlights: ["Garage", "Jardin"] },
        { highlights: ["Garage", "Cave"] },
      ])
    ).toEqual(["Garage"]);
  });
});
