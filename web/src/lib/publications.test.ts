import { describe, expect, it } from "vitest";
import { getDisplayPublications } from "./publications";

describe("getDisplayPublications", () => {
  it("returns only active publications", () => {
    const result = getDisplayPublications({
      publications: [
        {
          id: 1,
          externalId: "active",
          source: "bienici",
          url: "https://example.com/active",
          isActive: true,
          scrapedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          externalId: "inactive",
          source: "seloger",
          url: "https://example.com/inactive",
          isActive: false,
          scrapedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual([
      {
        key: "1",
        source: "bienici",
        url: "https://example.com/active",
        isActive: true,
      },
    ]);
  });

  it("returns nothing when all publications are inactive", () => {
    const result = getDisplayPublications({
      publications: [
        {
          id: 1,
          externalId: "inactive",
          source: "seloger",
          url: "https://example.com/inactive",
          isActive: false,
          scrapedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual([]);
  });

  it("returns nothing when publications are missing", () => {
    const result = getDisplayPublications({
      publications: [],
    });

    expect(result).toEqual([]);
  });
});
