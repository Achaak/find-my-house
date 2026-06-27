import { describe, expect, it } from "vitest";
import { isImmersiveRoute } from "./layout-routes";

describe("isImmersiveRoute", () => {
  it("treats listing detail as immersive", () => {
    expect(isImmersiveRoute("/listings/42")).toBe(true);
  });

  it("does not treat browse or listings index as immersive", () => {
    expect(isImmersiveRoute("/browse")).toBe(false);
    expect(isImmersiveRoute("/listings")).toBe(false);
    expect(isImmersiveRoute("/")).toBe(false);
  });
});
