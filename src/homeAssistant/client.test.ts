import { afterEach, describe, expect, it, vi } from "vitest";
import { parseHaService, resolveHaApiToken } from "./client.js";

describe("parseHaService", () => {
  it("parses domain.service notation", () => {
    expect(parseHaService("persistent_notification.create")).toEqual({
      domain: "persistent_notification",
      service: "create",
    });
    expect(parseHaService("notify.mobile_app_iphone")).toEqual({
      domain: "notify",
      service: "mobile_app_iphone",
    });
  });

  it("uses the same value for domain and service when no dot is present", () => {
    expect(parseHaService("notify")).toEqual({
      domain: "notify",
      service: "notify",
    });
  });
});

describe("resolveHaApiToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the request bearer token", () => {
    expect(resolveHaApiToken("user-token")).toBe("user-token");
  });

  it("prefers SUPERVISOR_TOKEN on the add-on", () => {
    vi.stubEnv("SUPERVISOR_TOKEN", "supervisor-token");
    expect(resolveHaApiToken("user-token")).toBe("supervisor-token");
  });
});
