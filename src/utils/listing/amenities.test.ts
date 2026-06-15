import { describe, expect, it } from "vitest";
import { highlightsSetsEqual } from "./amenities.js";

describe("highlightsSetsEqual", () => {
  it("ignores highlight order", () => {
    expect(
      highlightsSetsEqual(["Garage", "Terrasse"], ["Terrasse", "Garage"])
    ).toBe(true);
  });

  it("detects different highlight sets", () => {
    expect(highlightsSetsEqual(["Garage"], ["Terrasse"])).toBe(false);
  });
});
