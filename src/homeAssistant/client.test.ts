import { describe, expect, it } from "vitest";
import { parseHaService } from "./client.js";

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
