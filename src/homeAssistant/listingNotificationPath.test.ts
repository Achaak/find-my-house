import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildListingNotificationPath,
  buildListingsIndexPath,
  notificationClickData,
  resetIngressBasePathCache,
  resolveAddonSlug,
} from "./listingNotificationPath.js";

describe("listingNotificationPath", () => {
  afterEach(() => {
    resetIngressBasePathCache();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds a relative listing path without an add-on slug", () => {
    expect(buildListingNotificationPath(42, null)).toBe("/listings/42");
    expect(buildListingsIndexPath(null)).toBe("/listings");
  });

  it("prefixes listing paths with the HA panel slug", () => {
    const slug = "abc123_find_my_house";
    expect(buildListingNotificationPath(7, slug)).toBe(
      "/abc123_find_my_house/listings/7"
    );
    expect(buildListingsIndexPath(slug)).toBe("/abc123_find_my_house/listings");
  });

  it("duplicates click paths for iOS and Android", () => {
    expect(notificationClickData("/listings/3")).toEqual({
      url: "/listings/3",
      clickAction: "/listings/3",
    });
  });

  it("returns null without a supervisor token", async () => {
    await expect(resolveAddonSlug()).resolves.toBeNull();
  });

  it("fetches and caches the add-on slug from supervisor", async () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { slug: "abc123_find_my_house" },
        }),
        { status: 200 }
      )
    );

    await expect(resolveAddonSlug()).resolves.toBe("abc123_find_my_house");
    await expect(resolveAddonSlug()).resolves.toBe("abc123_find_my_house");
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://supervisor/addons/self/info",
      expect.objectContaining({
        headers: { Authorization: "Bearer supervisor-token" },
      })
    );
  });
});
