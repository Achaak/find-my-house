import { describe, expect, it, vi } from "vitest";
import type { ExtendedScrapeResult } from "../../types/listing.js";
import { handleScraper } from "./scraper.js";

vi.mock("../auth.js", () => ({
  canRunPrivilegedCommand: vi.fn(() => true),
  denyPrivilegedCommand: vi.fn(),
}));

const scrapeResult: ExtendedScrapeResult = {
  found: 5,
  inserted: 1,
  linked: 0,
  updated: 2,
  skipped: 2,
  deactivated: 1,
  insertedListings: [],
  linkedListings: [],
  priceDropListings: [],
  errors: [{ scraper: "seloger", message: "HTTP 403" }],
};

function makeInteraction() {
  return {
    deferReply: vi.fn(() => Promise.resolve(undefined)),
    editReply: vi.fn(() => Promise.resolve(undefined)),
  };
}

describe("handleScraper", () => {
  it("reports scraper failures in the Discord reply", async () => {
    const interaction = makeInteraction();
    const notifyScrapeResults = vi.fn(() => Promise.resolve(undefined));

    await handleScraper(interaction as never, {
      repository: {
        count: vi.fn(() => Promise.resolve(12)),
        countPublications: vi.fn(() => Promise.resolve(15)),
      },
      reactionRepository: {} as never,
      scraperService: {
        run: vi.fn(() => Promise.resolve(scrapeResult)),
      },
      defaultScrapeOptions: {
        city: "Paris",
        maxPrice: 500_000,
        minSurface: 30,
      },
      discord: {
        token: "token",
        adminRoleId: "admin",
      },
      notifyScrapeResults,
    });

    expect(interaction.deferReply).toHaveBeenCalledOnce();
    expect(notifyScrapeResults).toHaveBeenCalledWith(scrapeResult);
    expect(interaction.editReply).toHaveBeenCalledOnce();

    const reply = vi.mocked(interaction.editReply).mock.calls[0]?.[0];
    expect(String(reply)).toContain("seloger");
    expect(String(reply)).toContain("HTTP 403");
  });
});
