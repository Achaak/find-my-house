import { describe, expect, it } from "vitest";
import { parseNotifyServices } from "./notifyServices.js";

describe("parseNotifyServices", () => {
  it("returns the default when empty", () => {
    expect(parseNotifyServices("")).toEqual(["persistent_notification.create"]);
  });

  it("parses a single service", () => {
    expect(parseNotifyServices("notify.mobile_app_iphone")).toEqual([
      "notify.mobile_app_iphone",
    ]);
  });

  it("parses comma-separated services", () => {
    expect(
      parseNotifyServices("notify.mobile_app_iphone, notify.mobile_app_pixel")
    ).toEqual(["notify.mobile_app_iphone", "notify.mobile_app_pixel"]);
  });
});
