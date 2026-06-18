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

const callHaServices = vi.fn(
  async (services: string[], data: Record<string, unknown>) => {
    await Promise.all(services.map((service) => callHaService(service, data)));
    return { ok: true as const };
  }
);

vi.mock("./client.js", () => ({
  callHaService: (service: string, data: Record<string, unknown>) =>
    callHaService(service, data),
  callHaServices: (services: string[], data: Record<string, unknown>) =>
    callHaServices(services, data),
}));

const services = ["persistent_notification.create"] as const;
const multiServices = [
  "notify.mobile_app_iphone",
  "notify.mobile_app_pixel",
] as const;

describe("sendPriceDropNotifications", () => {
  afterEach(() => {
    callHaService.mockReset();
    callHaServices.mockClear();
  });

  it("skips properties without a real price drop", async () => {
    const sent = await sendPriceDropNotifications(services, [
      makePropertyRow({ id: 1, price: 300_000, firstPrice: 300_000 }),
    ]);

    expect(sent).toBe(0);
    expect(callHaService).not.toHaveBeenCalled();
  });

  it("sends a message for a property below first price", async () => {
    callHaService.mockResolvedValue({ ok: true });

    const sent = await sendPriceDropNotifications(services, [
      makePropertyRow({ id: 2, price: 280_000, firstPrice: 300_000 }),
    ]);

    expect(sent).toBe(1);
    expect(callHaService).toHaveBeenCalledOnce();
  });

  it("fans out to every configured service", async () => {
    callHaService.mockResolvedValue({ ok: true });

    const sent = await sendPriceDropNotifications(multiServices, [
      makePropertyRow({ id: 3, price: 280_000, firstPrice: 300_000 }),
    ]);

    expect(sent).toBe(1);
    expect(callHaService).toHaveBeenCalledTimes(2);
  });
});

describe("sendNewListingNotifications", () => {
  afterEach(() => {
    callHaService.mockReset();
    callHaServices.mockClear();
  });

  it("caps individual notifications and sends an overflow summary", async () => {
    callHaService.mockResolvedValue({ ok: true });
    const listings = Array.from({ length: 7 }, (_, index) =>
      makePropertyRow({ id: index + 1 })
    );

    const sent = await sendNewListingNotifications(services, listings, {
      maxNotifications: 3,
    });

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
    callHaServices.mockClear();
  });

  it("sends a test notification via the configured services", async () => {
    callHaService.mockResolvedValue({ ok: true });

    const result = await sendTestNotification(services);

    expect(result).toEqual({ ok: true });
    expect(callHaServices).toHaveBeenCalledOnce();
  });
});
