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
import type { ListingRepository } from "./listingRepository.js";
import { PropertySearchRepository } from "./propertySearchRepository.js";

vi.mock("../utils/geo/geocode.js", () => ({
  resolveGeoSearchCenter: vi.fn(),
}));

import { resolveGeoSearchCenter } from "../utils/geo/geocode.js";

const mockedResolveGeoSearchCenter = vi.mocked(resolveGeoSearchCenter);

const GEO_CENTER = { lat: 49.61, lng: 0.51 };

describe("PropertySearchRepository.search", () => {
  let repository: ListingRepository;
  let searchRepository: PropertySearchRepository;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    searchRepository = new PropertySearchRepository(testDb.prisma);
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function seedGeoListings() {
    mockedResolveGeoSearchCenter.mockResolvedValue({
      center: GEO_CENTER,
      placeName: "Lanquetot (76160)",
      zipcode: "76160",
    });

    await repository.upsertMany([
      makeListing({
        externalId: "geo-near-expensive",
        url: "https://www.bienici.com/annonce/geo-near-expensive",
        city: "Lanquetot",
        postalCode: "76160",
        latitude: 49.6105,
        longitude: 0.5105,
        price: 300_000,
        scrapedAt: "2026-06-01T10:00:00.000Z",
      }),
      makeListing({
        externalId: "geo-far-cheap",
        url: "https://www.bienici.com/annonce/geo-far-cheap",
        city: "Lillebonne",
        postalCode: "76170",
        latitude: 49.62,
        longitude: 0.52,
        price: 100_000,
        scrapedAt: "2026-06-03T10:00:00.000Z",
      }),
      makeListing({
        externalId: "geo-mid",
        url: "https://www.bienici.com/annonce/geo-mid",
        city: "Lanquetot",
        postalCode: "76160",
        latitude: 49.615,
        longitude: 0.515,
        price: 200_000,
        surface: 120,
        scrapedAt: "2026-06-02T10:00:00.000Z",
      }),
    ]);
  }

  it("respects price_asc sort under geo radius post-processing", async () => {
    await seedGeoListings();

    const { items, total } = await searchRepository.search({
      city: "Lanquetot",
      postalCode: "76160",
      maxTravelMinutes: 45,
      sort: "price_asc",
      limit: 10,
    });

    expect(total).toBe(3);
    expect(items.map((item) => item.price)).toEqual([
      100_000, 200_000, 300_000,
    ]);
  });

  it("respects price_desc sort under geo radius post-processing", async () => {
    await seedGeoListings();

    const { items } = await searchRepository.search({
      city: "Lanquetot",
      postalCode: "76160",
      maxTravelMinutes: 45,
      sort: "price_desc",
      limit: 10,
    });

    expect(items.map((item) => item.price)).toEqual([
      300_000, 200_000, 100_000,
    ]);
  });

  it("respects date_desc sort under geo radius post-processing", async () => {
    await seedGeoListings();

    const { items } = await searchRepository.search({
      city: "Lanquetot",
      postalCode: "76160",
      maxTravelMinutes: 45,
      sort: "date_desc",
      limit: 10,
    });

    expect(items.map((item) => item.publications[0]?.externalId)).toEqual([
      "geo-far-cheap",
      "geo-mid",
      "geo-near-expensive",
    ]);
  });

  it("paginates geo search results after sort", async () => {
    await seedGeoListings();

    const page = await searchRepository.search({
      city: "Lanquetot",
      postalCode: "76160",
      maxTravelMinutes: 45,
      sort: "price_asc",
      limit: 2,
      offset: 1,
    });

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.items.map((item) => item.price)).toEqual([200_000, 300_000]);
  });
});
