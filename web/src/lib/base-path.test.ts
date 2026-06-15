import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getIngressBasePath, withBasePath } from "./base-path";

describe("withBasePath", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      __INGRESS_PATH__: undefined,
      location: { pathname: "/" },
    });
    vi.stubGlobal("document", {
      querySelector: vi.fn(() => null),
    } as unknown as Document);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefixes paths with the injected ingress base", () => {
    window.__INGRESS_PATH__ = "/api/hassio_ingress/token123/";

    expect(withBasePath("/api/listings")).toBe(
      "/api/hassio_ingress/token123/api/listings"
    );
  });

  it("returns the path unchanged outside ingress", () => {
    expect(withBasePath("/api/listings")).toBe("/api/listings");
    expect(getIngressBasePath()).toBe("");
  });
});
