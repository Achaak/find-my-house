import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import { sendPriceDropNotifications } from "./notifications.js";

const post = vi.fn();

vi.mock("@discordjs/rest", () => ({
  REST: class {
    setToken() {
      return this;
    }
    post = post;
  },
}));

describe("sendPriceDropNotifications", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({});
  });

  it("skips properties without a real price drop", async () => {
    const sent = await sendPriceDropNotifications("token", "channel", [
      makePropertyRow({ id: 1, price: 300_000, firstPrice: 300_000 }),
    ]);

    expect(sent).toBe(0);
    expect(post).not.toHaveBeenCalled();
  });

  it("sends a message for a property below first price", async () => {
    const sent = await sendPriceDropNotifications("token", "channel", [
      makePropertyRow({ id: 2, price: 280_000, firstPrice: 300_000 }),
    ]);

    expect(sent).toBe(1);
    expect(post).toHaveBeenCalledOnce();
  });
});
