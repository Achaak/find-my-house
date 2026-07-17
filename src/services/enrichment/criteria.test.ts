import { describe, expect, it } from "vitest";
import {
  displayEnrichmentBackfillWhere,
  getEnrichmentStatus,
  publicationHasIncompleteLocalImages,
  publicationNeedsDisplayRefresh,
  publicationNeedsFirstDisplayEnrichment,
  propertyNeedsDisplayBackfill,
  propertyNeedsDisplayRefresh,
  propertyNeedsDisplayWork,
  propertyNeedsEnrichment,
} from "./criteria.js";
import { makePropertyRow } from "../../test/listingFixtures.js";
import type { PublicationRow } from "../../types/listing.js";
import { Prisma } from "../../generated/prisma/client.js";

function withPublication(
  overrides: Partial<PublicationRow>
): ReturnType<typeof makePropertyRow> {
  const base = makePropertyRow();
  const publication = { ...base.publications[0], ...overrides };
  return makePropertyRow({ publications: [publication] });
}

describe("display enrichment criteria", () => {
  it("treats enrichedAt null as first-time pending", () => {
    const property = withPublication({
      enrichedAt: null,
      description: null,
      imageUrl: null,
      imageUrls: null,
      imageLocalHashes: null,
    });

    expect(propertyNeedsDisplayBackfill(property)).toBe(true);
    expect(propertyNeedsEnrichment(property, "display")).toBe(true);
    expect(propertyNeedsDisplayRefresh(property)).toBe(false);
    expect(
      publicationNeedsFirstDisplayEnrichment(property.publications[0])
    ).toBe(true);
  });

  it("does not keep SeLoger refresh in backfill after enrichedAt is set", () => {
    const property = withPublication({
      source: "seloger",
      url: "https://www.seloger.com/s",
      description: "Truncated listing...",
      imageUrl: "https://mms.seloger.com/photo.jpg",
      imageUrls: ["https://mms.seloger.com/photo.jpg"],
      imageLocalHashes: { "https://mms.seloger.com/photo.jpg": "abc" },
      enrichedAt: "2026-01-15T10:00:00.000Z",
    });

    expect(propertyNeedsDisplayBackfill(property)).toBe(false);
    expect(propertyNeedsEnrichment(property, "display")).toBe(false);
    expect(propertyNeedsDisplayRefresh(property)).toBe(true);
    expect(propertyNeedsDisplayWork(property)).toBe(true);
    expect(getEnrichmentStatus(property, "display")).toBe("pending");
    expect(publicationNeedsDisplayRefresh(property.publications[0])).toBe(true);
  });

  it("flags incomplete local image hashes without filesystem checks", () => {
    expect(
      publicationHasIncompleteLocalImages({
        isActive: true,
        imageUrls: ["https://example.com/a.jpg"],
        imageLocalHashes: null,
      })
    ).toBe(true);

    expect(
      publicationHasIncompleteLocalImages({
        isActive: true,
        imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
        imageLocalHashes: { "https://example.com/a.jpg": "hash-a" },
      })
    ).toBe(true);

    expect(
      publicationHasIncompleteLocalImages({
        isActive: true,
        imageUrls: ["https://example.com/a.jpg"],
        imageLocalHashes: { "https://example.com/a.jpg": "hash-a" },
      })
    ).toBe(false);

    expect(
      publicationHasIncompleteLocalImages({
        isActive: true,
        imageUrls: [],
        imageLocalHashes: {},
      })
    ).toBe(false);

    expect(
      publicationHasIncompleteLocalImages({
        isActive: true,
        imageUrls: null,
        imageLocalHashes: {},
      })
    ).toBe(false);
  });

  it("exposes a SQL backfill where without portal-refresh clauses", () => {
    expect(displayEnrichmentBackfillWhere()).toEqual({
      OR: [
        {
          publications: {
            some: {
              isActive: true,
              enrichedAt: null,
            },
          },
        },
        {
          publications: {
            some: {
              isActive: true,
              enrichedAt: { not: null },
              AND: [
                { NOT: { imageUrls: { equals: Prisma.DbNull } } },
                { NOT: { imageUrls: { equals: [] } } },
              ],
              OR: [
                { imageLocalHashes: { equals: Prisma.DbNull } },
                { imageLocalHashes: { equals: {} } },
              ],
            },
          },
        },
      ],
    });
  });

  it("does not treat enriched no-photo listings as backfill pending", () => {
    const emptyGallery = withPublication({
      enrichedAt: "2026-01-15T10:00:00.000Z",
      imageUrls: [],
      imageLocalHashes: {},
    });
    const nullGallery = withPublication({
      enrichedAt: "2026-01-15T10:00:00.000Z",
      imageUrls: null,
      imageLocalHashes: {},
    });

    expect(propertyNeedsDisplayBackfill(emptyGallery)).toBe(false);
    expect(propertyNeedsDisplayBackfill(nullGallery)).toBe(false);
  });
});
