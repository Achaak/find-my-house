import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePropertyRow } from "../test/listingFixtures.js";
import {
  sendNewListingNotifications,
  sendPriceDropNotifications,
} from "./notifications.js";

const post = vi.fn();

type PostOptions = { body?: { content?: string } };

function postBody(callIndex: number): PostOptions["body"] {
  return (post.mock.calls[callIndex]?.[1] as PostOptions | undefined)?.body;
}

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

describe("sendNewListingNotifications", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({});
  });

  it("caps individual embeds and sends an overflow summary", async () => {
    const listings = Array.from({ length: 7 }, (_, index) =>
      makePropertyRow({ id: index + 1 })
    );

    const sent = await sendNewListingNotifications(
      "token",
      "channel",
      listings,
      { maxNotifications: 3 }
    );

    expect(sent).toBe(3);
    expect(post).toHaveBeenCalledTimes(4);
    expect(postBody(0)?.content).toContain("affichage des 3 premières");
    expect(postBody(3)?.content).toContain("4 autres annonces");
  });
});
