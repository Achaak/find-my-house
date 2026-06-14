import { beforeEach, describe, expect, it, vi } from "vitest";

const launchPersistentContext = vi.fn();

vi.mock("cloakbrowser", () => ({
  launchPersistentContext,
}));

vi.mock("../../config/browser.js", () => ({
  browserConfig: {
    browser: {
      profileDir: undefined,
      headless: true,
      humanize: true,
      proxy: undefined,
      geoip: false,
      resetProfile: false,
      fingerprint: undefined,
      storageQuota: undefined,
    },
  },
}));

describe("browser readiness", () => {
  beforeEach(() => {
    vi.resetModules();
    launchPersistentContext.mockReset();
  });

  it("starts idle and becomes ready after warm-up", async () => {
    launchPersistentContext.mockResolvedValue({
      close: vi.fn(),
      newPage: vi.fn(),
      cookies: vi.fn().mockResolvedValue([]),
      request: { get: vi.fn(), post: vi.fn() },
    });

    const { getBrowserReadiness, startBrowserWarmUp, ensureBrowserReady } =
      await import("./client.js");

    expect(getBrowserReadiness()).toEqual({ browser: "idle" });

    startBrowserWarmUp();
    expect(getBrowserReadiness().browser).toBe("starting");

    await ensureBrowserReady();
    expect(getBrowserReadiness()).toEqual({ browser: "ready" });
  });

  it("reports error state when warm-up fails", async () => {
    launchPersistentContext.mockRejectedValue(new Error("download failed"));

    const { getBrowserReadiness, ensureBrowserReady } =
      await import("./client.js");

    await expect(ensureBrowserReady()).rejects.toThrow("download failed");
    expect(getBrowserReadiness().browser).toBe("error");
    expect(getBrowserReadiness().error).toBe("download failed");
  });
});
