import { afterEach, describe, expect, it, vi } from "vitest";
import { retryBrowserOperation } from "./retryFetch.js";

vi.mock("./client.js", () => ({
  warmUpBrowserSession: vi.fn().mockResolvedValue(undefined),
  clearBrowserCookiesForHost: vi.fn().mockResolvedValue(undefined),
  isBrowserAccessBlocked: vi.fn().mockReturnValue(false),
}));

describe("retryBrowserOperation", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("retries until the operation succeeds", async () => {
    let attempts = 0;

    const result = await retryBrowserOperation({
      maxAttempts: 3,
      retryDelayMs: 1,
      warmUpOrigin: "https://example.com",
      run: () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("temporary");
        }
        return Promise.resolve("ok");
      },
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });
});
