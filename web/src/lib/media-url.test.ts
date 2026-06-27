import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMediaUrl } from "./media-url";

describe("resolveMediaUrl", () => {
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

  it("prefixes local media paths behind ingress", () => {
    window.__INGRESS_PATH__ = "/api/hassio_ingress/token123/";

    expect(resolveMediaUrl("/api/media/abc123")).toBe(
      "/api/hassio_ingress/token123/api/media/abc123"
    );
  });

  it("leaves remote portal URLs unchanged", () => {
    window.__INGRESS_PATH__ = "/api/hassio_ingress/token123/";

    expect(resolveMediaUrl("https://photos.bienici.com/a.jpg")).toBe(
      "https://photos.bienici.com/a.jpg"
    );
  });

  it("returns local media paths unchanged outside ingress", () => {
    expect(resolveMediaUrl("/api/media/abc123")).toBe("/api/media/abc123");
  });
});
