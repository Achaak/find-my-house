import { describe, expect, it } from "vitest";
import { normalizeHaPanelPath } from "./panel-path";

describe("normalizeHaPanelPath", () => {
  it("returns home for an empty route tail", () => {
    expect(normalizeHaPanelPath({ path: "" })).toBe("/");
    expect(normalizeHaPanelPath({})).toBe("/");
  });

  it("keeps a full listing detail path", () => {
    expect(normalizeHaPanelPath({ path: "/listings/42" })).toBe("/listings/42");
  });

  it("reconstructs listing detail paths from HA's numeric tail", () => {
    expect(normalizeHaPanelPath({ path: "/42" })).toBe("/listings/42");
  });

  it("keeps other in-app paths unchanged", () => {
    expect(normalizeHaPanelPath({ path: "/browse" })).toBe("/browse");
    expect(normalizeHaPanelPath({ path: "/listings" })).toBe("/listings");
  });
});
