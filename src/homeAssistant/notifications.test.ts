import { afterEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
  sendTestNotification,
} from "./notifications.js";

const callHaService =
  vi.fn<
    (service: string, data: Record<string, unknown>) => Promise<{ ok: true }>
  >();

vi.mock("./client.js", () => ({
  callHaService: (service: string, data: Record<string, unknown>) =>
    callHaService(service, data),
}));

describe("sendPriceDropNotifications", () => {
  afterEach(() => {
    callHaService.mockReset();
  });

  it("skips properties without a real price drop", async () => {
    const sent = await sendPriceDropNotifications(
      "persistent_notification.create",
      [makePropertyRow({ id: 1, price: 300_000, firstPrice: 300_000 })]
    );

    expect(sent).toBe(0);
    expect(callHaService).not.toHaveBeenCalled();
  });

  it("sends a message for a property below first price", async () => {
    callHaService.mockResolvedValue({ ok: true });

    const sent = await sendPriceDropNotifications(
      "persistent_notification.create",
      [makePropertyRow({ id: 2, price: 280_000, firstPrice: 300_000 })]
    );

    expect(sent).toBe(1);
    expect(callHaService).toHaveBeenCalledOnce();
  });
});

describe("sendNewListingNotifications", () => {
  afterEach(() => {
    callHaService.mockReset();
  });

  it("caps individual notifications and sends an overflow summary", async () => {
    callHaService.mockResolvedValue({ ok: true });
    const listings = Array.from({ length: 7 }, (_, index) =>
      makePropertyRow({ id: index + 1 })
    );

    const sent = await sendNewListingNotifications(
      "persistent_notification.create",
      listings,
      { maxNotifications: 3 }
    );

    expect(sent).toBe(3);
    expect(callHaService).toHaveBeenCalledTimes(4);
    const [, firstPayload] = callHaService.mock.calls[0] as [
      string,
      { message: string },
    ];
    const [, overflowPayload] = callHaService.mock.calls[3] as [
      string,
      { message: string },
    ];
    expect(firstPayload.message).toEqual(
      expect.stringContaining("7 nouvelles annonces")
    );
    expect(overflowPayload.message).toEqual(
      expect.stringContaining("4 autres annonces")
    );
  });
});

describe("sendTestNotification", () => {
  afterEach(() => {
    callHaService.mockReset();
  });

  it("sends a test notification via the configured service", async () => {
    callHaService.mockResolvedValue({ ok: true });

    const result = await sendTestNotification("persistent_notification.create");

    expect(result).toEqual({ ok: true });
    const [, payload] = callHaService.mock.calls[0] as [
      string,
      { title: string; message: string },
    ];
    expect(payload.title).toEqual(expect.stringContaining("test"));
    expect(payload.message).toEqual(expect.stringContaining("page admin"));
  });
});
