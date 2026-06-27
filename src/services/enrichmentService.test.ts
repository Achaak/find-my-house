import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { computePropertyDescription } from "../domain/propertyDisplayFields.js";
import { makeListing, makePropertyRow } from "../test/listingFixtures.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { EnrichmentResult } from "./enrichmentService.js";
import type { ListingRepository } from "../db/listingRepository.js";
import {
  fetchBienIciAdById,
  fetchBienIciListingHtml,
} from "../utils/bienici/index.js";
import {
  fetchLeboncoinAdById,
  fetchLeboncoinDetailById,
} from "../utils/leboncoin/index.js";
import {
  fetchSeLogerListingDetails,
  SeLogerAccessBlockedError,
} from "../utils/seloger/index.js";
import {
  enrichProperty,
  ensurePropertyEnriched,
  propertyNeedsEnrichment,
} from "./enrichmentService.js";
import { photoUrlDedupKey } from "../utils/images/filterSyndicatedPhotoUrls.js";

vi.mock("../utils/bienici/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/bienici/index.js")>();
  return {
    ...actual,
    fetchBienIciAdById: vi.fn(),
    fetchBienIciListingHtml: vi.fn(),
  };
});

vi.mock("../utils/leboncoin/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/leboncoin/index.js")>();
  return {
    ...actual,
    fetchLeboncoinDetailById: vi.fn(),
    fetchLeboncoinAdById: vi.fn(),
  };
});

vi.mock("../utils/seloger/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/seloger/index.js")>();
  return {
    ...actual,
    fetchSeLogerListingDetails: vi.fn(),
  };
});

vi.mock("./imageDownloadService.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./imageDownloadService.js")>();
  return {
    ...actual,
    downloadPublicationImages: vi.fn(
      (
        urls: string[] | null,
        existing: Record<string, string> | null,
        existingPerceptual: Record<string, string> | null = null
      ) => ({
        localHashes: { ...(existing ?? {}) },
        perceptualHashes: { ...(existingPerceptual ?? {}) },
      })
    ),
    propertyHasMissingStoredImages: vi.fn().mockResolvedValue(false),
    publicationHasMissingStoredImages: vi.fn().mockResolvedValue(false),
  };
});

const mockFetchBienIci = vi.mocked(fetchBienIciAdById);
const mockFetchBienIciListingHtml = vi.mocked(fetchBienIciListingHtml);
const mockFetchLeboncoin = vi.mocked(fetchLeboncoinDetailById);
const mockFetchLeboncoinAd = vi.mocked(fetchLeboncoinAdById);
const mockFetchSeLoger = vi.mocked(fetchSeLogerListingDetails);

function publication(
  source: "seloger" | "bienici" | "leboncoin",
  id: number,
  externalId: string,
  overrides: Partial<import("../types/listing.js").PublicationRow> = {}
) {
  const scrapedAt = "2026-01-15T10:00:00.000Z";
  const urls: Record<typeof source, string> = {
    seloger: `https://www.seloger.com/annonces/achat/${externalId}.htm`,
    bienici: `https://www.bienici.com/annonce/${externalId}`,
    leboncoin: `https://www.leboncoin.fr/ad/${externalId}`,
  };

  return {
    id,
    externalId,
    source,
    url: urls[source],
    title: "Maison de test",
    price: 300_000,
    surface: 90,
    landSurface: 500,
    rooms: 5,
    bedrooms: 3,
    isNewProperty: false,
    latitude: 48.8566,
    longitude: 2.3522,
    city: "Paris",
    postalCode: "75001",
    address: null,
    dpeNumero: null,
    description: null,
    imageUrl: null,
    imageUrls: null,
    imageLocalHashes: null,
    imagePerceptualHashes: null,
    enrichedAt: null,
    propertyType: "house",
    dpeClass: "C",
    gesClass: "D",
    dpeConsumptionKwhM2: 120,
    gesEmissionKgM2: 25,
    bathrooms: null,
    constructionYear: null,
    heating: null,
    orientation: null,
    propertyCondition: null,
    parkingSpaces: null,
    highlights: null,
    isActive: true,
    scrapedAt,
    ...overrides,
  };
}

function publicationPatch(
  result: EnrichmentResult,
  publicationId: number
): PropertyEnrichmentPatch {
  return (
    result.patches.find((entry) => entry.publicationId === publicationId)
      ?.patch ?? {}
  );
}

function displayFieldsPatch(result: EnrichmentResult): PropertyEnrichmentPatch {
  return result.patches.reduce<PropertyEnrichmentPatch>(
    (merged, entry) => ({ ...merged, ...entry.patch }),
    {}
  );
}

async function markDisplayAndGalleryComplete(
  repository: ListingRepository,
  propertyId: number
) {
  const property = await repository.findById(propertyId);
  if (!property) throw new Error("Expected property");

  for (const publicationRow of property.publications) {
    await repository.applyPublicationGallery(publicationRow.id, {
      imageUrls:
        publicationRow.imageUrls ??
        (publicationRow.imageUrl ? [publicationRow.imageUrl] : null),
      imageLocalHashes: publicationRow.imageLocalHashes ?? {},
    });
  }

  for (const publicationRow of property.publications) {
    await repository.markPublicationEnrichmentAttempted(
      publicationRow.id,
      "display"
    );
  }
}

describe("propertyNeedsEnrichment", () => {
  it("requires display enrichment when an active publication has null enrichedAt", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          publications: [
            publication("bienici", 1, "bi-1", { enrichedAt: null }),
          ],
        }),
        "display"
      )
    ).toBe(true);
  });

  it("does not require numeric energy metrics for display when publications are enriched", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          dpeClass: "D",
          gesClass: "A",
          dpeConsumptionKwhM2: null,
          gesEmissionKgM2: null,
          publications: [
            publication("leboncoin", 1, "lbc-1", {
              enrichedAt: "2026-01-15T10:00:00.000Z",
              imageUrl: "https://example.com/photo.jpg",
            }),
          ],
        }),
        "display"
      )
    ).toBe(false);
  });

  it("ignores missing land surface on the property for display purpose", () => {
    expect(
      propertyNeedsEnrichment(makePropertyRow({ landSurface: null }), "display")
    ).toBe(false);
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          landSurface: null,
          publications: [
            publication("bienici", 1, "bi-1", { enrichedAt: null }),
          ],
        }),
        "display"
      )
    ).toBe(true);
  });

  it("requires display enrichment for SeLoger truncated descriptions", () => {
    const property = makePropertyRow({
      publications: [
        publication("seloger", 1, "sl-1", {
          enrichedAt: "2026-01-15T10:00:00.000Z",
          description: "Court résumé...",
        }),
      ],
    });

    expect(propertyNeedsEnrichment(property, "display")).toBe(true);
  });

  it("uses stricter rules for address purpose", () => {
    expect(
      propertyNeedsEnrichment(makePropertyRow({ surface: null }), "address")
    ).toBe(true);
    expect(
      propertyNeedsEnrichment(makePropertyRow({ landSurface: null }), "address")
    ).toBe(false);
  });

  it("requires display enrichment when publication imageUrl is missing", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          publications: [
            publication("bienici", 1, "bi-1", {
              enrichedAt: null,
              imageUrl: null,
            }),
          ],
        }),
        "display"
      )
    ).toBe(true);
  });

  it("returns false when all active publications are display-enriched", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          publications: [
            publication("leboncoin", 1, "lbc-1", {
              enrichedAt: "2026-01-15T10:00:00.000Z",
              imageUrl: "https://example.com/photo.jpg",
            }),
          ],
        }),
        "display"
      )
    ).toBe(false);
  });

  it("returns false after a display enrichment attempt even if fields stay missing", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          landSurface: null,
          publications: [
            publication("bienici", 1, "bi-1", {
              enrichedAt: "2026-06-15T10:00:00.000Z",
            }),
          ],
        }),
        "display"
      )
    ).toBe(false);
  });

  it("re-enriches display when a new publication is linked after a prior attempt", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          landSurface: null,
          addressEnrichedAt: null,
          publications: [
            publication("leboncoin", 1, "lbc-1", {
              enrichedAt: "2026-06-15T10:00:00.000Z",
            }),
            publication("bienici", 2, "bi-1", { enrichedAt: null }),
          ],
        }),
        "display"
      )
    ).toBe(true);
  });
});

describe("enrichProperty", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchBienIci.mockResolvedValue(null);
    mockFetchBienIciListingHtml.mockResolvedValue("");
    mockFetchLeboncoin.mockResolvedValue(null);
    mockFetchLeboncoinAd.mockResolvedValue(null);
  });

  it("prioritizes SeLoger over BienIci and Leboncoin for overlapping fields", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description SeLoger",
      surface: 100,
      landSurface: 600,
      rooms: 6,
      bedrooms: 4,
      latitude: 48.1,
      longitude: 2.1,
      dpeClass: "B",
      gesClass: "C",
      dpeConsumptionKwhM2: 90,
      gesEmissionKgM2: 15,
    });
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
      description: "Description BienIci",
      energyClassification: "D",
      greenhouseGazClassification: "E",
    });
    mockFetchLeboncoin.mockResolvedValue({
      ad: {
        list_id: 1,
        subject: "LBC",
        body: "Description Leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/1",
        price: [300_000],
        location: { city: "Paris", lat: 48.2, lng: 2.2 },
        attributes: [{ key: "energy_rate", value: "F" }],
      },
      imageUrl: null,
    });

    const property = makePropertyRow({
      dpeClass: null,
      gesClass: null,
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("leboncoin", 2, "lbc-1"),
        publication("seloger", 3, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.warnings).toEqual([]);
    expect(publicationPatch(result, 2).description).toBe(
      "Description Leboncoin"
    );
    expect(result.patch.dpeClass).toBe("B");
    expect(result.patch.gesClass).toBe("C");
    expect(result.patch.dpeConsumptionKwhM2).toBe(90);
    expect(result.patches.some((entry) => "description" in entry.patch)).toBe(
      true
    );
    expect(result.updatedFields).toContain("dpeClass");
  });

  it("prefers SeLoger og:image over BienIci when both publications exist", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description SeLoger",
      surface: null,
      landSurface: null,
      rooms: null,
      bedrooms: null,
      latitude: null,
      longitude: null,
      dpeClass: null,
      gesClass: null,
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
      imageUrl: "https://example.com/seloger-og.jpg",
    });
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
    });
    mockFetchBienIciListingHtml.mockResolvedValue(
      '<meta property="og:image" content="https://example.com/bienici-og.jpg">'
    );

    const result = await enrichProperty(
      makePropertyRow({
        publications: [
          publication("bienici", 1, "bi-1"),
          publication("seloger", 2, "sl-1"),
        ],
      })
    );

    expect(displayFieldsPatch(result).imageUrl).toBe(
      "https://example.com/seloger-og.jpg"
    );
    expect(mockFetchBienIciListingHtml).not.toHaveBeenCalled();
  });

  it("prefers Leboncoin og:image over BienIci when both publications exist", async () => {
    mockFetchLeboncoin.mockResolvedValue({
      ad: {
        list_id: 1,
        subject: "LBC",
        body: "Description Leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/1",
        price: [300_000],
        location: { city: "Paris", lat: 48.2, lng: 2.2 },
        attributes: [],
      },
      imageUrl: "https://example.com/leboncoin-og.jpg",
    });
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
    });
    mockFetchBienIciListingHtml.mockResolvedValue(
      '<meta property="og:image" content="https://example.com/bienici-og.jpg">'
    );

    const result = await enrichProperty(
      makePropertyRow({
        publications: [
          publication("bienici", 1, "bi-1"),
          publication("leboncoin", 2, "lbc-1"),
        ],
      })
    );

    expect(displayFieldsPatch(result).imageUrl).toBe(
      "https://example.com/leboncoin-og.jpg"
    );
    expect(mockFetchBienIciListingHtml).not.toHaveBeenCalled();
  });

  it("drops syndicated photo URLs blocked by cross-listing reuse", async () => {
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
      photos: [
        { url_photo: "https://cdn.safti.fr/good.jpg" },
        { url_photo: "https://media.immo-facile.com/spam.jpg?DATEMAJ=1" },
      ],
    });

    const result = await enrichProperty(
      makePropertyRow({
        publications: [publication("bienici", 1, "bi-1")],
      }),
      "display",
      {
        blockedPhotoUrlKeys: new Set([
          photoUrlDedupKey("https://media.immo-facile.com/spam.jpg"),
        ]),
      }
    );

    expect(publicationPatch(result, 1).imageUrls).toEqual([
      "https://cdn.safti.fr/good.jpg",
    ]);
    expect(publicationPatch(result, 1).imageUrl).toBe(
      "https://cdn.safti.fr/good.jpg"
    );
  });

  it("merges complementary fields from lower-priority sources", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description SeLoger",
      surface: null,
      landSurface: null,
      rooms: null,
      bedrooms: null,
      latitude: null,
      longitude: null,
      dpeClass: null,
      gesClass: null,
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
    });
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
      landSurfaceArea: 750,
      photos: [{ url_photo: "https://example.com/og-photo.jpg" }],
    });
    mockFetchLeboncoin.mockResolvedValue(null);
    mockFetchLeboncoinAd.mockResolvedValue(null);

    const property = makePropertyRow({
      landSurface: null,
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("seloger", 2, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.patch.landSurface).toBe(750);
    expect(displayFieldsPatch(result).imageUrl).toBe(
      "https://example.com/og-photo.jpg"
    );
    expect(displayFieldsPatch(result).description).toBe("Description SeLoger");
  });

  it("keeps existing property values and fills gaps from other sources", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description SeLoger",
      surface: null,
      landSurface: null,
      rooms: null,
      bedrooms: null,
      latitude: null,
      longitude: null,
      dpeClass: "B",
      gesClass: "C",
      dpeConsumptionKwhM2: 90,
      gesEmissionKgM2: 15,
    });
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
      description: "Description BienIci",
      energyClassification: "D",
      greenhouseGazClassification: "E",
      energyConsumption: 200,
      greenhouseGazConsumption: 50,
    });

    const result = await enrichProperty(
      makePropertyRow({
        dpeClass: "D",
        gesClass: "A",
        dpeConsumptionKwhM2: null,
        gesEmissionKgM2: null,
        publications: [
          publication("bienici", 1, "bi-1", {
            description: "Description existante",
          }),
          publication("seloger", 2, "sl-1"),
        ],
      })
    );

    expect(result.patch.description).toBeUndefined();
    expect(result.patch.dpeClass).toBeUndefined();
    expect(result.patch.dpeConsumptionKwhM2).toBe(90);
    expect(result.patch.gesEmissionKgM2).toBe(15);
  });

  it("omits fields that already match the property", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description existante",
      surface: 90,
      landSurface: 500,
      rooms: 5,
      bedrooms: 3,
      latitude: 48.8566,
      longitude: 2.3522,
      dpeClass: "C",
      gesClass: "D",
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
    });

    const result = await enrichProperty(
      makePropertyRow({
        publications: [publication("seloger", 1, "sl-1")],
      })
    );

    expect(result.updatedFields).toEqual([]);
    expect(result.patch).toEqual({});
  });

  it("continues after SeLoger access block and records a warning", async () => {
    mockFetchSeLoger.mockRejectedValue(new SeLogerAccessBlockedError());
    mockFetchBienIci.mockResolvedValue({
      id: "bi-1",
      title: "BienIci",
      price: 300_000,
      city: "Paris",
      description: "Description de secours",
      energyClassification: "A",
      greenhouseGazClassification: "B",
    });
    mockFetchLeboncoin.mockResolvedValue(null);
    mockFetchLeboncoinAd.mockResolvedValue(null);

    const property = makePropertyRow({
      dpeClass: null,
      publications: [
        publication("seloger", 1, "sl-1"),
        publication("bienici", 2, "bi-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("SeLoger is blocking enrichment");
    expect(displayFieldsPatch(result).description).toBe(
      "Description de secours"
    );
    expect(result.patch.dpeClass).toBe("A");
  });

  it("records a warning when a non-SeLoger source fails", async () => {
    mockFetchBienIci.mockRejectedValue(new Error("API indisponible"));
    mockFetchSeLoger.mockResolvedValue({
      description: "OK",
      surface: null,
      landSurface: null,
      rooms: null,
      bedrooms: null,
      latitude: null,
      longitude: null,
      dpeClass: null,
      gesClass: null,
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
    });

    const property = makePropertyRow({
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("seloger", 2, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.warnings).toEqual(["bienici: API indisponible"]);
    expect(displayFieldsPatch(result).description).toBe("OK");
  });

  it("skips display-only fetches for address purpose", async () => {
    mockFetchSeLoger.mockResolvedValue({
      description: "Description",
      surface: 90,
      landSurface: 400,
      rooms: 4,
      bedrooms: 2,
      latitude: 45.75,
      longitude: 4.85,
      dpeClass: "C",
      gesClass: "D",
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
      imageUrl: "https://example.com/photo.jpg",
    });

    const property = makePropertyRow({
      surface: null,
      publications: [publication("seloger", 1, "sl-1", { surface: null })],
    });

    const result = await enrichProperty(property, "address");

    expect(publicationPatch(result, 1).surface).toBe(90);
    expect(result.patch.surface).toBe(90);
    expect(result.patch.description).toBeUndefined();
    expect(result.patch.imageUrl).toBeUndefined();
    expect(result.patch.landSurface).toBeUndefined();
  });
});

describe("ensurePropertyEnriched", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchBienIci.mockResolvedValue(null);
    mockFetchBienIciListingHtml.mockResolvedValue("");
    mockFetchLeboncoin.mockResolvedValue(null);
    mockFetchLeboncoinAd.mockResolvedValue(null);
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterEach(async () => {
    await dispose?.();
  });

  it("returns the property unchanged when enrichment is not needed", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "full-1",
        description: "Description complète",
        imageUrl: "https://example.com/photo.jpg",
        dpeConsumptionKwhM2: 100,
        gesEmissionKgM2: 20,
      })
    );

    if (!inserted.row) {
      throw new Error("Expected inserted property row");
    }

    await markDisplayAndGalleryComplete(repository, inserted.row.id);

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(result.property).toBeDefined();
    if (!result.property) return;
    expect(computePropertyDescription(result.property.publications)).toBe(
      "Description complète"
    );
    expect(mockFetchSeLoger).not.toHaveBeenCalled();
    expect(mockFetchBienIci).not.toHaveBeenCalled();
  });

  it("applies enrichment patches to the database", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "enrich-1",
        description: null,
        dpeClass: null,
        gesClass: null,
        dpeConsumptionKwhM2: null,
        gesEmissionKgM2: null,
      })
    );

    mockFetchBienIci.mockResolvedValue({
      id: "enrich-1",
      title: "Maison enrichie",
      price: 300_000,
      city: "Paris",
      description: "Nouvelle description",
      energyClassification: "B",
      greenhouseGazClassification: "C",
      energyConsumption: 88,
      greenhouseGazConsumption: 12,
    });
    mockFetchBienIciListingHtml.mockResolvedValue(
      '<meta property="og:image" content="https://example.com/og-photo.jpg">'
    );

    if (!inserted.row) {
      throw new Error("Expected inserted property row");
    }

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(result.property).toBeDefined();
    if (!result.property) return;
    expect(computePropertyDescription(result.property.publications)).toBe(
      "Nouvelle description"
    );
    expect(result.property.dpeClass).toBe("B");
    expect(result.property.gesClass).toBe("C");
    expect(result.property.dpeConsumptionKwhM2).toBe(88);
    expect(
      result.property.publications.every((row) => row.enrichedAt !== null)
    ).toBe(true);
  });

  it("marks display enrichment as attempted when enrichment cannot fill remaining gaps", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "enrich-noop-1",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/enrich-noop-1",
        description: "Description existante",
        imageUrl: "https://example.com/photo.jpg",
        landSurface: null,
        dpeClass: "D",
        gesClass: "A",
      })
    );

    mockFetchLeboncoin.mockResolvedValue({
      ad: {
        list_id: 1,
        subject: "Maison",
        body: "Description existante",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/1",
        price: [300_000],
        location: { city: "Paris", lat: 48.1, lng: 2.1 },
        attributes: [
          { key: "energy_rate", value: "d" },
          { key: "ges", value: "a" },
        ],
      },
      imageUrl: "https://example.com/photo.jpg",
    });

    if (!inserted.row) {
      throw new Error("Expected inserted property row");
    }

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(
      result.property?.publications.every((row) => row.enrichedAt !== null)
    ).toBe(true);
    expect(result.property?.landSurface).toBeNull();
    if (!result.property) {
      throw new Error("Expected enriched property");
    }
    expect(propertyNeedsEnrichment(result.property, "display")).toBe(false);
  });

  it("skips enrichment for display-complete listings", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "enrich-complete-2",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/enrich-complete-2",
        description: "Description existante",
        imageUrl: "https://example.com/photo.jpg",
        landSurface: 500,
        dpeClass: "D",
        gesClass: "A",
      })
    );

    if (!inserted.row) {
      throw new Error("Expected inserted property row");
    }

    await markDisplayAndGalleryComplete(repository, inserted.row.id);
    const marked = await repository.findById(inserted.row.id);
    expect(marked?.publications.every((row) => row.enrichedAt !== null)).toBe(
      true
    );

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(
      result.property?.publications.every((row) => row.enrichedAt !== null)
    ).toBe(true);
    expect(mockFetchLeboncoin).not.toHaveBeenCalled();
  });

  it("returns undefined when the property does not exist", async () => {
    const result = await ensurePropertyEnriched(repository, 999_999, "display");

    expect(result.property).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});
