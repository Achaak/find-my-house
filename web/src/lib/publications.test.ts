import { describe, expect, it } from "vitest";
import { getDisplayPublications } from "./publications";

describe("getDisplayPublications", () => {
  it("prefers active publications", () => {
    const result = getDisplayPublications({
      source: "bienici",
      url: "https://example.com/primary",
      publications: [
        {
          id: 1,
          externalId: "a",
          source: "bienici",
          url: "https://example.com/bienici",
          isActive: true,
          scrapedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          externalId: "b",
          source: "seloger",
          url: "https://example.com/seloger",
          isActive: false,
          scrapedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual([
      {
        key: "1",
        source: "bienici",
        url: "https://example.com/bienici",
        isActive: true,
      },
    ]);
  });

  it("falls back to all publications when none are active", () => {
    const result = getDisplayPublications({
      source: "bienici",
      url: "https://example.com/primary",
      publications: [
        {
          id: 2,
          externalId: "b",
          source: "seloger",
          url: "https://example.com/seloger",
          isActive: false,
          scrapedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("seloger");
  });

  it("falls back to primary url when publications are missing", () => {
    const result = getDisplayPublications({
      source: "leboncoin",
      url: "https://example.com/leboncoin",
      publications: [],
    });

    expect(result).toEqual([
      {
        key: "leboncoin",
        source: "leboncoin",
        url: "https://example.com/leboncoin",
        isActive: true,
      },
    ]);
  });
});
