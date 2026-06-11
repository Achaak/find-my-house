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
});
