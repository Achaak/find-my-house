import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestRepository } from "../test/db.js";
import { makeListing } from "../test/listingFixtures.js";
import { ProjectionUpdater } from "./projectionUpdater.js";
import type { ListingRepository } from "./listingRepository.js";
import type { PrismaClient } from "../generated/prisma/client.js";

describe("ProjectionUpdater", () => {
  let repository: ListingRepository;
  let projectionUpdater: ProjectionUpdater;
  let prisma: PrismaClient;
  let dispose: (() => Promise<void>) | undefined;

  beforeAll(() => {
    const testDb = createTestRepository();
    repository = testDb.repository;
    prisma = testDb.prisma;
    projectionUpdater = new ProjectionUpdater(prisma);
    dispose = testDb.dispose;
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("refreshes projection and hasPriceDrop from publications", async () => {
    const primaryListing = makeListing({
      externalId: "pu-bienici",
      source: "bienici",
      url: "https://www.bienici.com/annonce/pu-bienici",
      title: "Priority publication",
      price: 520_000,
      postalCode: "69001",
      city: "Lyon",
    });
    const fallbackListing = makeListing({
      externalId: "pu-lbc",
      source: "leboncoin",
      url: "https://www.leboncoin.fr/ad/pu-lbc",
      title: "Fallback publication",
      price: 480_000,
      postalCode: "69001",
      city: "Lyon",
      scrapedAt: "2026-01-16T10:00:00.000Z",
    });

    const inserted = await repository.upsert(primaryListing);
    if (!inserted.row) throw new Error("Expected inserted property");
    const propertyId = inserted.row.id;

    await prisma.listingPublication.create({
      data: {
        propertyId,
        externalId: fallbackListing.externalId,
        source: fallbackListing.source,
        url: fallbackListing.url,
        title: fallbackListing.title,
        price: fallbackListing.price,
        surface: fallbackListing.surface,
        landSurface: fallbackListing.landSurface,
        rooms: fallbackListing.rooms,
        bedrooms: fallbackListing.bedrooms,
        isNewProperty: fallbackListing.isNewProperty,
        latitude: fallbackListing.latitude,
        longitude: fallbackListing.longitude,
        city: fallbackListing.city,
        postalCode: fallbackListing.postalCode,
        address: null,
        dpeNumero: null,
        description: fallbackListing.description,
        imageUrl: fallbackListing.imageUrl,
        propertyType: fallbackListing.propertyType,
        dpeClass: fallbackListing.dpeClass,
        gesClass: fallbackListing.gesClass,
        dpeConsumptionKwhM2: fallbackListing.dpeConsumptionKwhM2,
        gesEmissionKgM2: fallbackListing.gesEmissionKgM2,
        bathrooms: fallbackListing.bathrooms,
        constructionYear: fallbackListing.constructionYear,
        heating: fallbackListing.heating,
        orientation: fallbackListing.orientation,
        propertyCondition: fallbackListing.propertyCondition,
        parkingSpaces: fallbackListing.parkingSpaces,
        highlights: fallbackListing.highlights,
        scrapedAt: new Date(fallbackListing.scrapedAt),
      },
    });

    await prisma.listingPublication.updateMany({
      where: { propertyId, source: "bienici" },
      data: { isActive: false },
    });

    const refreshed = await projectionUpdater.refresh(propertyId);
    expect(refreshed.ok).toBe(true);
    if (!refreshed.ok) return;

    expect(refreshed.value.title).toBe("Fallback publication");
    expect(refreshed.value.price).toBe(480_000);
    const propertyAfterRefresh = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { hasPriceDrop: true },
    });
    expect(propertyAfterRefresh?.hasPriceDrop).toBe(true);
  });

  it("returns Not found for unknown property", async () => {
    const result = await projectionUpdater.refresh(999_999_999);
    expect(result).toEqual({ ok: false, error: "Not found" });
  });

  it("returns No publications found when property has no publications", async () => {
    const inserted = await repository.upsert(
      makeListing({
        externalId: "pu-empty",
        url: "https://www.bienici.com/annonce/pu-empty",
      })
    );
    expect(inserted.row).toBeDefined();
    if (!inserted.row) return;

    await prisma.listingPublication.deleteMany({
      where: { propertyId: inserted.row.id },
    });

    const result = await projectionUpdater.refresh(inserted.row.id);
    expect(result).toEqual({ ok: false, error: "No publications found" });
  });

  it("refreshMany collects per-property results", async () => {
    const one = await repository.upsert(
      makeListing({
        externalId: "pu-many-1",
        url: "https://www.bienici.com/annonce/pu-many-1",
      })
    );
    const two = await repository.upsert(
      makeListing({
        externalId: "pu-many-2",
        url: "https://www.bienici.com/annonce/pu-many-2",
      })
    );

    if (!one.row || !two.row) throw new Error("Expected inserted rows");

    const results = await projectionUpdater.refreshMany([
      one.row.id,
      999_999_998,
      two.row.id,
    ]);

    expect(results).toHaveLength(3);
    expect(results[0]?.ok).toBe(true);
    expect(results[1]).toEqual({ ok: false, error: "Not found" });
    expect(results[2]?.ok).toBe(true);
  });
});
