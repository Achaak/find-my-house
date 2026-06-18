import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildListingNotificationPath,
  buildListingsIndexPath,
  notificationClickData,
  resetIngressBasePathCache,
  resolveIngressBasePath,
} from "./listingNotificationPath.js";

describe("listingNotificationPath", () => {
  afterEach(() => {
    resetIngressBasePathCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds a relative listing path without ingress", () => {
    expect(buildListingNotificationPath(42, null)).toBe("/listings/42");
    expect(buildListingsIndexPath(null)).toBe("/listings");
  });

  it("prefixes listing paths with the ingress base", () => {
    const base = "/api/hassio_ingress/abc123";
    expect(buildListingNotificationPath(7, base)).toBe(
      "/api/hassio_ingress/abc123/listings/7"
    );
    expect(buildListingsIndexPath(base)).toBe(
      "/api/hassio_ingress/abc123/listings"
    );
  });

  it("duplicates click paths for iOS and Android", () => {
    expect(notificationClickData("/listings/3")).toEqual({
      url: "/listings/3",
      clickAction: "/listings/3",
    });
  });

  it("returns null without a supervisor token", async () => {
    await expect(resolveIngressBasePath()).resolves.toBeNull();
  });

  it("fetches and caches the ingress base from supervisor", async () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { ingress_url: "/api/hassio_ingress/stable-token/" },
        }),
        { status: 200 }
      )
    );

    await expect(resolveIngressBasePath()).resolves.toBe(
      "/api/hassio_ingress/stable-token"
    );
    await expect(resolveIngressBasePath()).resolves.toBe(
      "/api/hassio_ingress/stable-token"
    );
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
