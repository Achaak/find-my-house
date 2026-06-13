import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import type { ListingRepository } from "./listingRepository.js";

describe("ListingRepository.upsert", () => {
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

    const leboncoinResults = await repository.search({
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
