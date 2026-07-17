import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import {
  propertyNeedsDisplayBackfill,
  propertyNeedsEnrichment,
} from "../services/enrichment/criteria.js";
import type { ListingRepository } from "./listingRepository.js";
import type { PrismaClient } from "../generated/prisma/client.js";

vi.mock("../utils/geo/geocode.js", () => ({
  resolveGeoSearchCenter: vi.fn(),
}));

import { resolveGeoSearchCenter } from "../utils/geo/geocode.js";

const mockedResolveGeoSearchCenter = vi.mocked(resolveGeoSearchCenter);

describe("ListingRepository.upsert", () => {
  let repository: ListingRepository;
  let prisma: PrismaClient;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    prisma = testDb.prisma;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("inserts a new property and publication", async () => {
    const result = await repository.upsert(
      makeListing({ externalId: "new-1" })
    );

    expect(result.status).toBe("inserted");
    expect(result.row?.publications).toHaveLength(1);
    expect(result.row?.publications[0]?.source).toBe("bienici");
  });

  it("skips unchanged listings", async () => {
    const listing = makeListing({
      externalId: "skip-1",
      url: "https://www.bienici.com/annonce/skip-1",
    });

    await repository.upsert(listing);
    const second = await repository.upsert(listing);

    expect(second.status).toBe("skipped");
  });

  it("links a second portal publication to the same property", async () => {
    const base = {
      postalCode: "69001",
      price: 420_000,
      surface: 110,
      rooms: 6,
      bedrooms: 4,
      city: "Lyon",
    };

    const bienici = makeListing({
      ...base,
      externalId: "link-bienici",
      source: "bienici",
      url: "https://www.bienici.com/annonce/link-bienici",
    });
    const leboncoin = makeListing({
      ...base,
      externalId: "link-lbc",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/link-lbc",
      title: "Autre titre",
    });

    const first = await repository.upsert(bienici);
    const second = await repository.upsert(leboncoin);

    expect(first.status).toBe("inserted");
    expect(second.status).toBe("linked");
    expect(second.row?.id).toBe(first.row?.id);
    expect(second.row?.publications).toHaveLength(2);
  });

  it("detects a price drop below first price", async () => {
    const listing = makeListing({
      externalId: "drop-1",
      url: "https://www.bienici.com/annonce/drop-1",
      price: 500_000,
    });

    await repository.upsert(listing);

    const updated = await repository.upsert({
      ...listing,
      price: 470_000,
      scrapedAt: "2026-01-16T10:00:00.000Z",
    });

    expect(updated.status).toBe("updated");
    expect(updated.priceDropped).toBe(true);
    expect(updated.row?.price).toBe(470_000);
    expect(updated.row?.firstPrice).toBe(500_000);
  });

  it("persists near-miss diagnostics when no property match is found", async () => {
    await repository.upsert(
      makeListing({
        externalId: "diag-base",
        url: "https://www.bienici.com/annonce/diag-base",
        postalCode: "75001",
        price: 300_000,
      })
    );

    await repository.upsert(
      makeListing({
        externalId: "diag-near-miss",
        url: "https://www.bienici.com/annonce/diag-near-miss",
        postalCode: "75001",
        price: 293_000,
      })
    );

    const diagnostics = await prisma.propertyMatchDiagnostic.findMany({
      where: { listingExternalId: "diag-near-miss" },
    });

    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0]?.bestScore).not.toBeNull();
    expect(diagnostics[0]?.nearMisses).toBeDefined();
  });
});

describe("ListingRepository.upsertMany", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("aggregates insert and skip counts", async () => {
    const listings = [
      makeListing({
        externalId: "batch-1",
        url: "https://www.bienici.com/annonce/batch-1",
      }),
      makeListing({
        externalId: "batch-2",
        url: "https://www.bienici.com/annonce/batch-2",
        price: 310_000,
      }),
    ];

    const firstRun = await repository.upsertMany(listings);
    const secondRun = await repository.upsertMany(listings);

    expect(firstRun.found).toBe(2);
    expect(firstRun.inserted).toBe(2);
    expect(firstRun.insertedListings).toHaveLength(2);

    expect(secondRun.skipped).toBe(2);
    expect(secondRun.inserted).toBe(0);
  });

  it("skips unchanged listings even when scrapedAt differs", async () => {
    const listing = makeListing({
      externalId: "batch-scraped-at",
      url: "https://www.bienici.com/annonce/batch-scraped-at",
    });

    await repository.upsertMany([listing]);
    const secondRun = await repository.upsertMany([
      { ...listing, scrapedAt: "2026-06-13T12:00:00.000Z" },
    ]);

    expect(secondRun.skipped).toBe(1);
    expect(secondRun.updated).toBe(0);
  });

  it("handles batches larger than SQLite bind-parameter limit", async () => {
    const listings = Array.from({ length: 400 }, (_, index) =>
      makeListing({
        externalId: `large-batch-${String(index)}`,
        url: `https://www.bienici.com/annonce/large-batch-${String(index)}`,
        postalCode: String(76000 + index).padStart(5, "0"),
        price: 300_000 + index * 10_000,
      })
    );

    const result = await repository.upsertMany(listings);

    expect(result.found).toBe(400);
    expect(result.inserted).toBe(400);
    expect(result.insertedListings).toHaveLength(400);
  });

  it("deduplicates listings by source and external id", async () => {
    const listings = [
      makeListing({
        externalId: "dup-1",
        url: "https://www.bienici.com/annonce/dup-1",
        price: 300_000,
      }),
      makeListing({
        externalId: "dup-1",
        url: "https://www.bienici.com/annonce/dup-1",
        price: 290_000,
      }),
    ];

    const result = await repository.upsertMany(listings);

    expect(result.found).toBe(1);
    expect(result.inserted).toBe(1);
  });

  it("links listings with fuzzy-matching attributes to the same property", async () => {
    const base = {
      postalCode: "76170",
      surface: 125,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1509,
      city: "Lillebonne",
      propertyType: "Maison",
      isNewProperty: false,
    };

    const first = await repository.upsert(
      makeListing({
        ...base,
        price: 195_500,
        externalId: "fuzzy-bienici",
        source: "bienici",
        url: "https://www.bienici.com/annonce/fuzzy-bienici",
      })
    );

    const second = await repository.upsert(
      makeListing({
        ...base,
        price: 195_500,
        propertyType: "house",
        externalId: "3165003203",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/3165003203",
      })
    );

    expect(first.status).toBe("inserted");
    expect(second.status).toBe("linked");
    expect(second.row?.id).toBe(first.row?.id);
    expect(second.row?.publications).toHaveLength(2);
  });

  it("clears enrichment markers when a publication is linked", async () => {
    const base = {
      postalCode: "27999",
      surface: 125,
      rooms: 5,
      bedrooms: 3,
      landSurface: 1509,
      city: "EnrichResetVille",
      propertyType: "Maison",
      isNewProperty: false,
      price: 195_500,
    };

    const first = await repository.upsert(
      makeListing({
        ...base,
        externalId: "enrich-reset-bienici-unique",
        source: "bienici",
        url: "https://www.bienici.com/annonce/enrich-reset-bienici-unique",
      })
    );
    if (!first.row) throw new Error("Expected first property");

    const enrichedBeforeMark = await repository.findById(first.row.id);
    const bieniciPublication = enrichedBeforeMark?.publications.find(
      (row) => row.source === "bienici"
    );
    if (!bieniciPublication) throw new Error("Expected Bienici publication");
    await repository.markPublicationEnrichmentAttempted(
      bieniciPublication.id,
      "display"
    );
    const enriched = await repository.findById(first.row.id);
    expect(
      enriched?.publications.find((row) => row.source === "bienici")?.enrichedAt
    ).not.toBeNull();

    await repository.upsert(
      makeListing({
        ...base,
        propertyType: "house",
        externalId: "enrich-reset-lbc-unique",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/enrich-reset-lbc-unique",
      })
    );

    const afterLink = await repository.findById(first.row.id);
    expect(
      afterLink?.publications.find((row) => row.source === "leboncoin")
        ?.enrichedAt
    ).toBeNull();
    expect(afterLink?.addressEnrichedAt).toBeNull();
    expect(afterLink).toBeDefined();
    if (!afterLink) return;
    expect(propertyNeedsEnrichment(afterLink, "display")).toBe(true);
    expect(afterLink.publications).toHaveLength(2);
  });

  it("links a Bienici republication from the same agency", async () => {
    const base = {
      postalCode: "76400",
      price: 300_000,
      surface: 152,
      rooms: 7,
      bedrooms: 5,
      landSurface: 1009,
      city: "Sainte-Hélène-Bondeville",
      propertyType: "Maison",
      isNewProperty: false,
    };

    const first = await repository.upsert(
      makeListing({
        ...base,
        externalId: "dr-house-immo-1-3138859",
        source: "bienici",
        url: "https://www.bienici.com/annonce/dr-house-immo-1-3138859",
      })
    );

    const second = await repository.upsert(
      makeListing({
        ...base,
        price: 299_000,
        externalId: "dr-house-immo-1-486880",
        source: "bienici",
        url: "https://www.bienici.com/annonce/dr-house-immo-1-486880",
        scrapedAt: "2026-02-01T00:00:00.000Z",
      })
    );

    expect(first.status).toBe("inserted");
    expect(second.status).toBe("linked");
    expect(second.row?.id).toBe(first.row?.id);
    expect(second.row?.publications).toHaveLength(2);
  });

  it("does not duplicate publications when merging pending creates", async () => {
    const base = {
      postalCode: "75000",
      price: 300_000,
      surface: 90,
      rooms: 5,
      bedrooms: 3,
      city: "Paris",
    };

    const result = await repository.upsertMany([
      makeListing({
        ...base,
        externalId: "merge-first",
        source: "bienici",
        url: "https://www.bienici.com/annonce/merge-first",
        title: "Short title",
      }),
      makeListing({
        ...base,
        externalId: "merge-second",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/merge-second",
        title: "Much longer title with more detail",
        description: "Longer description for the same house",
      }),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.linked).toBe(1);
    expect(result.insertedListings).toHaveLength(1);
    expect(result.insertedListings[0]?.publications).toHaveLength(2);
  });

  it("links cross-portal listings in one batch when fuzzy fields differ", async () => {
    const leboncoin = {
      postalCode: "76190",
      price: 239_000,
      surface: 124,
      rooms: 7,
      bedrooms: 6,
      landSurface: 1500,
      city: "Saint Martin de l'If",
      propertyType: "Maison",
      isNewProperty: false,
    };

    const result = await repository.upsertMany([
      makeListing({
        ...leboncoin,
        externalId: "lbc-saint-martin",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/lbc-saint-martin",
        title: "Pavillon 7 pièces 124 m²",
      }),
      makeListing({
        ...leboncoin,
        rooms: null,
        bedrooms: null,
        propertyType: null,
        isNewProperty: null,
        externalId: "limmo-saint-martin",
        source: "logicimmo",
        url: "https://www.logic-immo.com/annonces/achat/maison/limmo-saint-martin.htm",
        title: "Maison à vendre",
      }),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.linked).toBe(1);
    expect(result.insertedListings).toHaveLength(1);
    expect(result.insertedListings[0]?.publications).toHaveLength(2);
  });

  it("links the Bréauté cross-portal case when Logic-Immo lacks surface", async () => {
    const shared = {
      postalCode: "76110",
      price: 239_000,
      rooms: 4,
      bedrooms: 3,
      landSurface: 2142,
      city: "Bréauté",
    };

    const result = await repository.upsertMany([
      makeListing({
        ...shared,
        surface: 110,
        propertyType: "Maison",
        isNewProperty: false,
        externalId: "lbc-breaute",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/lbc-breaute",
        title: "Maison 4 pièces 110 m²",
      }),
      makeListing({
        ...shared,
        surface: null,
        landSurface: 2140,
        propertyType: "Maison à vendre",
        isNewProperty: null,
        externalId: "limmo-breaute",
        source: "logicimmo",
        url: "https://www.logic-immo.com/annonces/achat/maison/limmo-breaute.htm",
        title: "Maison à vendre",
      }),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.linked).toBe(1);
    expect(result.insertedListings[0]?.publications).toHaveLength(2);
  });

  it("links the Yvetot cross-portal case across property keys", async () => {
    const shared = {
      postalCode: "76190",
      price: 240_000,
      surface: 170,
      rooms: 5,
      bedrooms: 3,
      landSurface: 48_000,
      city: "Yvetot",
    };

    const result = await repository.upsertMany([
      makeListing({
        ...shared,
        propertyType: "Propriété",
        isNewProperty: false,
        externalId: "lbc-yvetot",
        source: "leboncoin",
        url: "https://www.leboncoin.fr/ad/ventes_immobilieres/lbc-yvetot",
        title: "Propriété 5 pièces 170 m²",
      }),
      makeListing({
        ...shared,
        propertyType: "Maison",
        isNewProperty: null,
        externalId: "limmo-yvetot",
        source: "logicimmo",
        url: "https://www.logic-immo.com/annonces/achat/maison/limmo-yvetot.htm",
        title: "Maison à vendre",
      }),
    ]);

    expect(result.inserted).toBe(1);
    expect(result.linked).toBe(1);
    expect(result.insertedListings[0]?.publications).toHaveLength(2);
  });
});

describe("ListingRepository.deactivateMissingPublications", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("deactivates publications missing from the latest scrape for a source", async () => {
    const kept = makeListing({
      externalId: "lbc-kept",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/lbc-kept",
    });
    const removed = makeListing({
      externalId: "lbc-removed",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/lbc-removed",
      price: 310_000,
    });

    await repository.upsertMany([kept, removed]);

    const deactivated = await repository.deactivateMissingPublications(
      "leboncoin",
      [kept]
    );

    expect(deactivated).toBe(1);
    expect(await repository.countPublications()).toBe(1);

    const { items: leboncoinResults } = await repository.search({
      source: "leboncoin",
      limit: 10,
    });
    expect(leboncoinResults).toHaveLength(1);
    expect(leboncoinResults[0]?.publications).toEqual([
      expect.objectContaining({ externalId: "lbc-kept", isActive: true }),
    ]);
  });

  it("reactivates a publication when it reappears in a scrape", async () => {
    const listing = makeListing({
      externalId: "lbc-back",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/lbc-back",
    });

    await repository.upsertMany([listing]);
    await repository.deactivateMissingPublications("leboncoin", []);
    expect(await repository.countPublications()).toBe(0);

    const second = await repository.upsert(listing);

    expect(second.status).toBe("updated");
    expect(second.row?.publications).toEqual([
      expect.objectContaining({ externalId: "lbc-back", isActive: true }),
    ]);
    expect(await repository.countPublications()).toBe(1);
  });

  it("refreshes property projection when deactivating publications", async () => {
    const bienici = makeListing({
      externalId: "projection-bienici",
      source: "bienici",
      url: "https://www.bienici.com/annonce/projection-bienici",
      title: "Priority publication",
      price: 520_000,
      city: "Lyon",
      postalCode: "69001",
      surface: 110,
      rooms: 6,
      bedrooms: 4,
    });
    const leboncoin = makeListing({
      externalId: "projection-lbc",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/projection-lbc",
      title: "Fallback publication",
      price: 520_000,
      city: "Lyon",
      postalCode: "69001",
      surface: 110,
      rooms: 6,
      bedrooms: 4,
    });

    await repository.upsertMany([bienici, leboncoin]);
    const before = await repository.search({ limit: 200 });
    const beforeProperty = before.items.find((item) =>
      item.publications.some(
        (publication) => publication.externalId === "projection-bienici"
      )
    );
    expect(beforeProperty).toBeDefined();
    expect(beforeProperty?.title).toBe("Priority publication");
    expect(beforeProperty?.price).toBe(520_000);

    const deactivated = await repository.deactivateMissingPublications(
      "bienici",
      []
    );

    expect(deactivated).toBe(1);
    const after = await repository.search({ limit: 200 });
    const afterProperty = after.items.find(
      (item) => item.id === beforeProperty?.id
    );
    expect(afterProperty?.title).toBe("Fallback publication");
    expect(afterProperty?.price).toBe(520_000);
    expect(afterProperty?.publications).toEqual([
      expect.objectContaining({ source: "leboncoin", isActive: true }),
    ]);
    expect(
      afterProperty?.publications.some(
        (publication) => publication.source === "bienici"
      )
    ).toBe(false);
  });
});

describe("ListingRepository.stats", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("aggregates source, price, city and activity stats", async () => {
    const base = {
      postalCode: "69001",
      price: 420_000,
      surface: 110,
      rooms: 6,
      bedrooms: 4,
      city: "Lyon",
    };

    const bienici = makeListing({
      ...base,
      externalId: "stats-bienici",
      source: "bienici",
      url: "https://www.bienici.com/annonce/stats-bienici",
    });
    const leboncoin = makeListing({
      ...base,
      externalId: "stats-lbc",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/stats-lbc",
      title: "Maison Lyon",
    });
    const dropped = makeListing({
      externalId: "stats-drop",
      source: "seloger",
      url: "https://www.seloger.com/annonces/stats-drop",
      city: "Villeurbanne",
      postalCode: "69100",
      price: 500_000,
    });

    await repository.upsertMany([bienici, leboncoin, dropped]);
    await repository.upsert({
      ...dropped,
      price: 450_000,
      scrapedAt: "2026-06-12T10:00:00.000Z",
    });

    const removed = makeListing({
      externalId: "stats-removed",
      source: "seloger",
      url: "https://www.seloger.com/annonces/stats-removed",
      city: "Lyon",
      postalCode: "69002",
      price: 390_000,
    });
    await repository.upsert(removed);
    await repository.deactivateMissingPublications("seloger", [dropped]);

    const sourceCounts = await repository.getPublicationCountsBySource();
    expect(sourceCounts.bienici.active).toBe(1);
    expect(sourceCounts.leboncoin.active).toBe(1);
    expect(sourceCounts.seloger.active).toBe(1);
    expect(sourceCounts.seloger.inactive).toBe(1);

    expect(await repository.countActiveProperties()).toBe(2);
    expect(await repository.countInactivePublications()).toBe(1);
    expect(await repository.countPriceDrops()).toBe(1);

    const priceStats = await repository.getPriceStats();
    expect(priceStats?.count).toBe(2);
    expect(priceStats?.min).toBe(420_000);

    const topCities = await repository.getTopCities(2);
    expect(topCities).toHaveLength(2);

    const drops = await repository.findPriceDrops(1);
    expect(drops[0]?.id).toBeDefined();
    expect(drops[0]?.price).toBe(450_000);

    const activity = await repository.getActivityStats();
    expect(activity.lastScrapedAt).not.toBeNull();
    expect(activity.multiSourceCount).toBe(1);
  });
});

describe("ListingRepository.countPendingDisplayEnrichment", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("matches display enrichment backfill criteria across the catalog", async () => {
    const complete = makeListing({
      externalId: "enrich-complete",
      url: "https://www.bienici.com/annonce/enrich-complete",
      description: "Complete listing",
      imageUrl: "https://example.com/photo.jpg",
      landSurface: 400,
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
    });
    const pending = makeListing({
      externalId: "enrich-pending",
      url: "https://www.bienici.com/annonce/enrich-pending",
      price: 310_000,
      surface: 95,
      description: null,
      imageUrl: null,
      landSurface: null,
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
    });
    const stalePortalImage = makeListing({
      externalId: "enrich-portal-image",
      source: "seloger",
      url: "https://www.seloger.com/annonces/enrich-portal-image",
      description: "Portal listing",
      imageUrl: "https://mms.seloger.com/6/a/0/4/photo.jpg",
      landSurface: 500,
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 25,
      latitude: 45.75,
      longitude: 4.85,
    });

    await repository.upsertMany([complete, pending, stalePortalImage]);

    const scanned = await repository.findPropertiesForEnrichmentScan(1000);
    const expected = scanned.filter(propertyNeedsDisplayBackfill).length;

    expect(await repository.countPendingDisplayEnrichment()).toBe(expected);
    expect(expected).toBeGreaterThanOrEqual(2);
  });
});

describe("ListingRepository.search", () => {
  let repository: ListingRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not filter by postal code when a travel-time geo filter is active", async () => {
    mockedResolveGeoSearchCenter.mockResolvedValue({
      center: { lat: 49.61, lng: 0.51 },
      placeName: "Lanquetot (76160)",
      zipcode: "76160",
    });

    await repository.upsertMany([
      makeListing({
        externalId: "geo-local",
        url: "https://www.bienici.com/annonce/geo-local",
        city: "Lanquetot",
        postalCode: "76160",
        latitude: 49.61,
        longitude: 0.51,
      }),
      makeListing({
        externalId: "geo-nearby",
        url: "https://www.bienici.com/annonce/geo-nearby",
        city: "Lillebonne",
        postalCode: "76170",
        latitude: 49.62,
        longitude: 0.52,
      }),
    ]);

    const { items, total } = await repository.search({
      city: "Lanquetot",
      postalCode: "76160",
      maxTravelMinutes: 45,
      limit: 10,
    });

    expect(total).toBe(2);
    expect(items.map((item) => item.postalCode).sort()).toEqual([
      "76160",
      "76170",
    ]);
  });

  it("still filters by postal code in city-only search mode", async () => {
    await repository.upsertMany([
      makeListing({
        externalId: "city-local",
        url: "https://www.bienici.com/annonce/city-local",
        city: "Lanquetot",
        postalCode: "76160",
      }),
      makeListing({
        externalId: "city-other",
        url: "https://www.bienici.com/annonce/city-other",
        city: "Lanquetot",
        postalCode: "76170",
      }),
    ]);

    const { items, total } = await repository.search({
      city: "Lanquetot",
      postalCode: "76160",
      limit: 10,
    });

    expect(total).toBe(1);
    expect(items[0]?.postalCode).toBe("76160");
  });

  it("paginates city searches at the database layer", async () => {
    await repository.upsertMany([
      makeListing({
        externalId: "page-a",
        url: "https://www.bienici.com/annonce/page-a",
        city: "Pagetown",
        price: 100_000,
      }),
      makeListing({
        externalId: "page-b",
        url: "https://www.bienici.com/annonce/page-b",
        city: "Pagetown",
        price: 200_000,
      }),
      makeListing({
        externalId: "page-c",
        url: "https://www.bienici.com/annonce/page-c",
        city: "Pagetown",
        price: 300_000,
      }),
    ]);

    const page = await repository.search({
      city: "Pagetown",
      sort: "price_asc",
      limit: 2,
      offset: 1,
    });

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.price)).toEqual([200_000, 300_000]);
  });

  it("filters priceDropOnly listings via hasPriceDrop", async () => {
    const fullPrice = makeListing({
      externalId: "price-drop-full",
      url: "https://www.bienici.com/annonce/price-drop-full",
      price: 400_000,
    });
    const dropped = makeListing({
      externalId: "price-drop-sale",
      url: "https://www.bienici.com/annonce/price-drop-sale",
      price: 400_000,
    });

    await repository.upsertMany([fullPrice, dropped]);
    await repository.upsert({
      ...dropped,
      price: 360_000,
      scrapedAt: "2026-06-12T10:00:00.000Z",
    });

    const { items, total } = await repository.search({ priceDropOnly: true });
    expect(total).toBe(1);
    expect(items[0]?.price).toBe(360_000);
  });
});
