import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing, makePropertyRow } from "../test/listingFixtures.js";
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

const mockFetchBienIci = vi.mocked(fetchBienIciAdById);
const mockFetchBienIciListingHtml = vi.mocked(fetchBienIciListingHtml);
const mockFetchLeboncoin = vi.mocked(fetchLeboncoinDetailById);
const mockFetchLeboncoinAd = vi.mocked(fetchLeboncoinAdById);
const mockFetchSeLoger = vi.mocked(fetchSeLogerListingDetails);

function publication(
  source: "seloger" | "bienici" | "leboncoin",
  id: number,
  externalId: string
) {
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
    scrapedAt: "2026-01-15T10:00:00.000Z",
  };
}

describe("propertyNeedsEnrichment", () => {
  it("requires DPE/GES classes for display energy", () => {
    const property = makePropertyRow({
      dpeClass: null,
      gesClass: "D",
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
    });

    expect(propertyNeedsEnrichment(property, "display")).toBe(true);
  });

  it("does not require numeric energy metrics for display", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          dpeClass: "D",
          gesClass: "A",
          dpeConsumptionKwhM2: null,
          gesEmissionKgM2: null,
          imageUrl: "https://example.com/photo.jpg",
        }),
        "display"
      )
    ).toBe(false);
  });

  it("requires land surface and description for display", () => {
    expect(
      propertyNeedsEnrichment(makePropertyRow({ landSurface: null }), "display")
    ).toBe(true);
    expect(
      propertyNeedsEnrichment(makePropertyRow({ description: null }), "display")
    ).toBe(true);
  });

  it("requires coords for SeLoger publications on display", () => {
    const property = makePropertyRow({
      latitude: null,
      longitude: null,
      publications: [publication("seloger", 1, "sl-1")],
      source: "seloger",
      url: "https://www.seloger.com/annonces/achat/sl-1.htm",
    });

    expect(propertyNeedsEnrichment(property, "display")).toBe(true);
  });

  it("uses stricter rules for address purpose", () => {
    expect(
      propertyNeedsEnrichment(makePropertyRow({ surface: null }), "address")
    ).toBe(true);
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({ landSurface: null, description: null }),
        "address"
      )
    ).toBe(false);
  });

  it("requires image URL for display", () => {
    expect(
      propertyNeedsEnrichment(makePropertyRow({ imageUrl: null }), "display")
    ).toBe(true);
  });

  it("returns false when display fields are complete", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({ imageUrl: "https://example.com/photo.jpg" }),
        "display"
      )
    ).toBe(false);
  });

  it("returns false after a display enrichment attempt even if fields stay missing", () => {
    expect(
      propertyNeedsEnrichment(
        makePropertyRow({
          landSurface: null,
          displayEnrichedAt: "2026-06-15T10:00:00.000Z",
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
          displayEnrichedAt: null,
          addressEnrichedAt: null,
          publications: [
            publication("leboncoin", 1, "lbc-1"),
            publication("bienici", 2, "bi-1"),
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
      description: null,
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
    expect(result.patch.description).toBe("Description SeLoger");
    expect(result.patch.dpeClass).toBe("B");
    expect(result.patch.gesClass).toBe("C");
    expect(result.patch.dpeConsumptionKwhM2).toBe(90);
    expect(result.updatedFields).toContain("description");
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
        imageUrl: null,
        publications: [
          publication("bienici", 1, "bi-1"),
          publication("seloger", 2, "sl-1"),
        ],
      })
    );

    expect(result.patch.imageUrl).toBe("https://example.com/seloger-og.jpg");
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
        imageUrl: null,
        publications: [
          publication("bienici", 1, "bi-1"),
          publication("leboncoin", 2, "lbc-1"),
        ],
      })
    );

    expect(result.patch.imageUrl).toBe("https://example.com/leboncoin-og.jpg");
    expect(mockFetchBienIciListingHtml).not.toHaveBeenCalled();
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
    });
    mockFetchBienIciListingHtml.mockResolvedValue(
      '<meta property="og:image" content="https://example.com/og-photo.jpg">'
    );
    mockFetchLeboncoin.mockResolvedValue(null);
    mockFetchLeboncoinAd.mockResolvedValue(null);

    const property = makePropertyRow({
      description: null,
      landSurface: null,
      imageUrl: null,
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("seloger", 2, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.patch.landSurface).toBe(750);
    expect(result.patch.imageUrl).toBe("https://example.com/og-photo.jpg");
    expect(result.patch.description).toBe("Description SeLoger");
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
        description: "Description existante",
        dpeClass: "D",
        gesClass: "A",
        dpeConsumptionKwhM2: null,
        gesEmissionKgM2: null,
        publications: [
          publication("bienici", 1, "bi-1"),
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
      description: null,
      dpeClass: null,
      publications: [
        publication("seloger", 1, "sl-1"),
        publication("bienici", 2, "bi-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("SeLoger is blocking enrichment");
    expect(result.patch.description).toBe("Description de secours");
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
      description: null,
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("seloger", 2, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.warnings).toEqual(["bienici: API indisponible"]);
    expect(result.patch.description).toBe("OK");
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
      publications: [publication("seloger", 1, "sl-1")],
      source: "seloger",
      url: "https://www.seloger.com/annonces/achat/sl-1.htm",
    });

    const result = await enrichProperty(property, "address");

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

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(result.property?.description).toBe("Description complète");
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
    expect(result.property?.description).toBe("Nouvelle description");
    expect(result.property?.dpeClass).toBe("B");
    expect(result.property?.gesClass).toBe("C");
    expect(result.property?.dpeConsumptionKwhM2).toBe(88);
    expect(result.property?.displayEnrichedAt).not.toBeNull();
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
    expect(result.property?.displayEnrichedAt).not.toBeNull();
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

    const result = await ensurePropertyEnriched(
      repository,
      inserted.row.id,
      "display"
    );

    expect(result.warnings).toEqual([]);
    expect(result.property?.displayEnrichedAt).toBeNull();
    expect(mockFetchLeboncoin).not.toHaveBeenCalled();
  });

  it("returns undefined when the property does not exist", async () => {
    const result = await ensurePropertyEnriched(repository, 999_999, "display");

    expect(result.property).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});
