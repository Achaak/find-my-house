import { describe, expect, it } from "vitest";
import { navItemActive } from "./nav-items";

describe("navItemActive", () => {
  it("matches home only on exact path", () => {
    expect(navItemActive("/", "/")).toBe(true);
    expect(navItemActive("/browse", "/")).toBe(false);
  });

  it("matches listings and detail routes", () => {
    expect(navItemActive("/listings", "/listings")).toBe(true);
    expect(navItemActive("/listings/42", "/listings")).toBe(true);
  });

  it("matches browse prefix", () => {
    expect(navItemActive("/browse", "/browse")).toBe(true);
  });
});
