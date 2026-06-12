import { describe, expect, it } from "vitest";
import type { ExtendedScrapeResult } from "../types/listing.js";
import { formatScrapeSummary } from "./formatScrapeSummary.js";

const baseResult: ExtendedScrapeResult = {
  found: 10,
  inserted: 2,
  linked: 1,
  updated: 3,
  skipped: 4,
  deactivated: 0,
  insertedListings: [],
  priceDropListings: [],
  errors: [],
};

describe("formatScrapeSummary", () => {
  it("includes scraper failures in the summary", () => {
    const summary = formatScrapeSummary(
      {
        ...baseResult,
        errors: [{ scraper: "seloger", message: "Access blocked" }],
      },
      { city: "Paris" }
    );

    expect(summary).toContain("seloger");
    expect(summary).toContain("Access blocked");
    expect(summary).toContain("1 scraper(s) en échec");
  });
});
