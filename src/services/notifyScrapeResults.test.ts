import { describe, expect, it, vi } from "vitest";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { makePropertyRow } from "../test/listingFixtures.js";
import { notifyScrapeResults } from "./notifyScrapeResults.js";

vi.mock("../discord/notifications.js", () => ({
  sendNewListingNotifications: vi.fn(() => Promise.resolve(2)),
  sendPriceDropNotifications: vi.fn(() => Promise.resolve(1)),
}));

import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "../discord/notifications.js";

const emptyResult: ExtendedScrapeResult = {
  found: 0,
  inserted: 0,
  linked: 0,
  updated: 0,
  skipped: 0,
  deactivated: 0,
  insertedListings: [],
  priceDropListings: [],
  errors: [],
};

describe("notifyScrapeResults", () => {
  it("skips Discord when channelId is missing", async () => {
    const summary = await notifyScrapeResults(emptyResult, {
      token: "token",
    });

    expect(summary).toEqual({ newListingsSent: 0, priceDropsSent: 0 });
    expect(sendNewListingNotifications).not.toHaveBeenCalled();
    expect(sendPriceDropNotifications).not.toHaveBeenCalled();
  });

  it("sends new listing and price drop notifications", async () => {
    const result: ExtendedScrapeResult = {
      ...emptyResult,
      insertedListings: [makePropertyRow({ id: 1 })],
      priceDropListings: [makePropertyRow({ id: 2 })],
    };

    const summary = await notifyScrapeResults(result, {
      token: "token",
      channelId: "channel",
    });

    expect(summary).toEqual({ newListingsSent: 2, priceDropsSent: 1 });
    expect(sendNewListingNotifications).toHaveBeenCalledOnce();
    expect(sendPriceDropNotifications).toHaveBeenCalledOnce();
  });
});
