import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing, makePropertyRow } from "../test/listingFixtures.js";
import type { ListingRepository } from "../db/listingRepository.js";
import { fetchBienIciAdById } from "../utils/bienici/index.js";
import { fetchLeboncoinAdById } from "../utils/leboncoin/index.js";
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
  };
});

vi.mock("../utils/leboncoin/index.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../utils/leboncoin/index.js")>();
  return {
    ...actual,
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
const mockFetchLeboncoin = vi.mocked(fetchLeboncoinAdById);
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
  it("requires energy metrics for display", () => {
    const property = makePropertyRow({
      dpeClass: null,
      gesClass: "D",
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
    });

    expect(propertyNeedsEnrichment(property, "display")).toBe(true);
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

  it("returns false when display fields are complete", () => {
    expect(propertyNeedsEnrichment(makePropertyRow(), "display")).toBe(false);
  });
});

describe("enrichProperty", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchBienIci.mockResolvedValue(null);
    mockFetchLeboncoin.mockResolvedValue(null);
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
      list_id: 1,
      subject: "LBC",
      body: "Description Leboncoin",
      price: [300_000],
      location: { lat: 48.2, lng: 2.2 },
      attributes: [{ key: "energy_rate", value: "F" }],
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
      photos: [{ url_photo: "https://example.com/photo.jpg" }],
    });
    mockFetchLeboncoin.mockResolvedValue(null);

    const property = makePropertyRow({
      landSurface: null,
      imageUrl: null,
      publications: [
        publication("bienici", 1, "bi-1"),
        publication("seloger", 2, "sl-1"),
      ],
    });

    const result = await enrichProperty(property);

    expect(result.patch.landSurface).toBe(750);
    expect(result.patch.imageUrl).toBe("https://example.com/photo.jpg");
    expect(result.patch.description).toBe("Description SeLoger");
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
    expect(result.warnings[0]).toContain("SeLoger bloque l'enrichissement");
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
});

describe("ensurePropertyEnriched", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchBienIci.mockResolvedValue(null);
    mockFetchLeboncoin.mockResolvedValue(null);
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
  });

  it("returns undefined when the property does not exist", async () => {
    const result = await ensurePropertyEnriched(repository, 999_999, "display");

    expect(result.property).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });
});
