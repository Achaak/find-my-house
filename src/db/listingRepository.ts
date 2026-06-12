import type {
  ListingPublication as PrismaPublication,
  PrismaClient,
  Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type {
  ExtendedScrapeResult,
  Listing,
  ListingSearchFilters,
  ListingSource,
  PropertyRow,
  ScrapeResult,
  UpsertStatus,
} from "../types/listing.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import { toPropertyRow } from "./listingMapper.js";
import {
  boundingBoxForRadiusKm,
  haversineDistanceKm,
  isWithinRadiusKm,
  type GeoPoint,
} from "../utils/geo/geo.js";
import { createLogger } from "../utils/logger.js";
import {
  resolveGeoFilter,
  resolveRadiusSearchFilter,
} from "../utils/geo/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geo/geocode.js";
import { findPropertyMatchForListing } from "./propertyMatchLookup.js";
import {
  type PublicationCreateData,
  toPublicationCreateData,
} from "./publicationData.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const propertyInclude = { publications: true } as const;
const log = createLogger("db");

const IN_QUERY_BATCH_SIZE = 900;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

function dedupeListings(listings: Listing[]): Listing[] {
  return [
    ...new Map(
      listings.map((listing) => [
        `${listing.source}:${listing.externalId}`,
        listing,
      ])
    ).values(),
  ];
}

function publicationKey(
  listing: Pick<Listing, "source" | "externalId">
): string {
  return `${listing.source}:${listing.externalId}`;
}

function mergeIntoPendingCreate(
  pending: PendingPropertyCreate,
  listing: Listing,
  scrapedAt: Date
): void {
  const listingKey = publicationKey(listing);

  if (listingKey !== publicationKey(pending.listing)) {
    const alreadyLinked = pending.extraPublications.some(
      (entry) => publicationKey(entry.listing) === listingKey
    );
    if (!alreadyLinked) {
      pending.extraPublications.push({ listing, scrapedAt });
    }
  }

  if (hasPropertyChanges(pending.listing, listing)) {
    const previousPrimary = pending.listing;
    const previousScrapedAt = pending.scrapedAt;

    if (publicationKey(previousPrimary) !== listingKey) {
      const previousPrimaryLinked = pending.extraPublications.some(
        (entry) =>
          publicationKey(entry.listing) === publicationKey(previousPrimary)
      );
      if (!previousPrimaryLinked) {
        pending.extraPublications.push({
          listing: previousPrimary,
          scrapedAt: previousScrapedAt,
        });
      }
    }

    pending.listing = listing;
    pending.scrapedAt = scrapedAt;
    pending.extraPublications = pending.extraPublications.filter(
      (entry) => publicationKey(entry.listing) !== listingKey
    );
  }
}

function pendingPublicationsToCreate(
  pending: PendingPropertyCreate
): PublicationCreateData[] {
  const seen = new Set<string>();
  const publications: PublicationCreateData[] = [];

  const add = (listing: Listing, scrapedAt: Date) => {
    const key = publicationKey(listing);
    if (seen.has(key)) return;
    seen.add(key);
    publications.push(toPublicationCreateData(listing, scrapedAt));
  };

  add(pending.listing, pending.scrapedAt);
  for (const entry of pending.extraPublications) {
    add(entry.listing, entry.scrapedAt);
  }

  return publications;
}

type PropertyWithPublications = PrismaProperty & {
  publications: PrismaPublication[];
};

type PublicationWithProperty = PrismaPublication & {
  property: PropertyWithPublications;
};

type PendingPropertyCreate = {
  listing: Listing;
  scrapedAt: Date;
  extraPublications: { listing: Listing; scrapedAt: Date }[];
};

function searchOrderBy(
  sort: ListingSearchFilters["sort"]
): { price: "asc" | "desc" } | { firstSeenAt: "desc" } | { surface: "desc" } {
  switch (sort) {
    case "price_desc":
      return { price: "desc" };
    case "date_desc":
      return { firstSeenAt: "desc" };
    case "surface_desc":
      return { surface: "desc" };
    default:
      return { price: "asc" };
  }
}

function toPropertyData(listing: Listing) {
  return {
    title: listing.title,
    price: listing.price,
    surface: listing.surface,
    landSurface: listing.landSurface,
    rooms: listing.rooms,
    bedrooms: listing.bedrooms,
    isNewProperty: listing.isNewProperty,
    latitude: listing.latitude,
    longitude: listing.longitude,
    city: listing.city,
    postalCode: listing.postalCode,
    description: listing.description,
    imageUrl: listing.imageUrl,
    propertyType: listing.propertyType,
    dpeClass: listing.dpeClass,
    gesClass: listing.gesClass,
    dpeConsumptionKwhM2: listing.dpeConsumptionKwhM2,
    gesEmissionKgM2: listing.gesEmissionKgM2,
  };
}

function isPriceDrop(
  previousPrice: number,
  newPrice: number,
  firstPrice: number
): boolean {
  return previousPrice !== newPrice && newPrice < firstPrice;
}

function hasPropertyChanges(
  existing: ReturnType<typeof toPropertyData>,
  listing: Listing
): boolean {
  return (
    existing.price !== listing.price ||
    existing.title !== listing.title ||
    existing.surface !== listing.surface ||
    existing.landSurface !== listing.landSurface ||
    existing.rooms !== listing.rooms ||
    existing.bedrooms !== listing.bedrooms ||
    existing.isNewProperty !== listing.isNewProperty ||
    existing.latitude !== listing.latitude ||
    existing.longitude !== listing.longitude ||
    existing.city !== listing.city ||
    existing.postalCode !== listing.postalCode ||
    existing.description !== listing.description ||
    existing.imageUrl !== listing.imageUrl ||
    existing.propertyType !== listing.propertyType ||
    existing.dpeClass !== listing.dpeClass ||
    existing.gesClass !== listing.gesClass ||
    existing.dpeConsumptionKwhM2 !== listing.dpeConsumptionKwhM2 ||
    existing.gesEmissionKgM2 !== listing.gesEmissionKgM2
  );
}

export class ListingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private async findExistingPublications(
    listings: Listing[]
  ): Promise<PublicationWithProperty[]> {
    const include = { property: { include: propertyInclude } };
    const byId = new Map<number, PublicationWithProperty>();

    const urls = [...new Set(listings.map((listing) => listing.url))];
    for (const urlBatch of chunk(urls, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.listingPublication.findMany({
        where: { url: { in: urlBatch } },
        include,
      });
      for (const row of rows) {
        byId.set(row.id, row);
      }
    }

    const externalIdsBySource = new Map<ListingSource, Set<string>>();
    for (const listing of listings) {
      const ids = externalIdsBySource.get(listing.source) ?? new Set<string>();
      ids.add(listing.externalId);
      externalIdsBySource.set(listing.source, ids);
    }

    for (const [source, externalIds] of externalIdsBySource) {
      for (const idBatch of chunk([...externalIds], IN_QUERY_BATCH_SIZE)) {
        const rows = await this.prisma.listingPublication.findMany({
          where: { source, externalId: { in: idBatch } },
          include,
        });
        for (const row of rows) {
          byId.set(row.id, row);
        }
      }
    }

    return [...byId.values()];
  }

  private async findPropertiesByPostalCodes(
    postalCodes: string[]
  ): Promise<PropertyWithPublications[]> {
    const byId = new Map<number, PropertyWithPublications>();

    for (const postalBatch of chunk(postalCodes, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.property.findMany({
        where: { postalCode: { in: postalBatch } },
        include: propertyInclude,
      });
      for (const row of rows) {
        byId.set(row.id, row);
      }
    }

    return [...byId.values()];
  }

  private async findPropertiesByKeys(
    propertyKeys: string[]
  ): Promise<PropertyWithPublications[]> {
    const byKey = new Map<string, PropertyWithPublications>();

    for (const keyBatch of chunk(propertyKeys, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.property.findMany({
        where: { propertyKey: { in: keyBatch } },
        include: propertyInclude,
      });
      for (const row of rows) {
        byKey.set(row.propertyKey, row);
      }
    }

    return [...byKey.values()];
  }

  private async findPropertyForListing(
    listing: Listing
  ): Promise<PropertyRow | undefined> {
    const publication = await this.prisma.listingPublication.findFirst({
      where: {
        OR: [
          { source: listing.source, externalId: listing.externalId },
          { url: listing.url },
        ],
      },
      include: { property: { include: propertyInclude } },
    });

    return publication ? toPropertyRow(publication.property) : undefined;
  }

  async upsert(listing: Listing): Promise<{
    status: UpsertStatus;
    row?: PropertyRow;
    priceDropped?: boolean;
  }> {
    const result = await this.upsertMany([listing]);

    if (result.skipped === 1) {
      return {
        status: "skipped",
        row: await this.findPropertyForListing(listing),
      };
    }

    if (result.inserted === 1) {
      return {
        status: "inserted",
        row: result.insertedListings[0],
      };
    }

    const row = await this.findPropertyForListing(listing);
    const priceDropped =
      row !== undefined &&
      result.priceDropListings.some((property) => property.id === row.id);

    if (result.linked === 1) {
      return { status: "linked", row, priceDropped: priceDropped || undefined };
    }

    if (result.updated === 1) {
      return {
        status: "updated",
        row,
        priceDropped: priceDropped || undefined,
      };
    }

    return { status: "skipped" };
  }

  async upsertMany(listings: Listing[]): Promise<ExtendedScrapeResult> {
    listings = dedupeListings(listings);

    if (listings.length === 0) {
      return {
        found: 0,
        inserted: 0,
        linked: 0,
        updated: 0,
        skipped: 0,
        deactivated: 0,
        insertedListings: [],
        priceDropListings: [],
        errors: [],
      };
    }

    const enriched = listings.map((listing) => ({
      listing,
      propertyKey: computePropertyKey(listing),
      scrapedAt: new Date(listing.scrapedAt),
    }));
    const propertyKeys = [
      ...new Set(enriched.map((entry) => entry.propertyKey)),
    ];

    const postalCodes = [
      ...new Set(
        listings
          .map((listing) => listing.postalCode)
          .filter((postalCode): postalCode is string => postalCode !== null)
      ),
    ];

    const [existingPublications, existingProperties, propertiesByPostal] =
      await Promise.all([
        this.findExistingPublications(listings),
        this.findPropertiesByKeys(propertyKeys),
        this.findPropertiesByPostalCodes(postalCodes),
      ]);

    const publicationBySourceExternalId = new Map<
      string,
      PublicationWithProperty
    >();
    const publicationByUrl = new Map<string, PublicationWithProperty>();
    for (const publication of existingPublications) {
      publicationBySourceExternalId.set(
        `${publication.source}:${publication.externalId}`,
        publication
      );
      publicationByUrl.set(publication.url, publication);
    }

    const propertyByKey = new Map(
      existingProperties.map((property) => [property.propertyKey, property])
    );
    const propertiesByPostalCode = new Map<
      string,
      PropertyWithPublications[]
    >();
    for (const property of propertiesByPostal) {
      if (!property.postalCode) continue;
      const bucket = propertiesByPostalCode.get(property.postalCode) ?? [];
      bucket.push(property);
      propertiesByPostalCode.set(property.postalCode, bucket);
    }

    const result: ScrapeResult = {
      found: listings.length,
      inserted: 0,
      linked: 0,
      updated: 0,
      skipped: 0,
      deactivated: 0,
    };
    const propertyUpdatesById = new Map<number, Listing>();
    const publicationScrapedAtById = new Map<number, Date>();
    const publicationReactivateById = new Set<number>();
    const pendingPropertyCreates = new Map<string, PendingPropertyCreate>();
    const linkedPublications: {
      propertyId: number;
      listing: Listing;
      scrapedAt: Date;
    }[] = [];
    const insertedPropertyIds: number[] = [];
    const priceDropPropertyIds = new Set<number>();

    const findExistingPublication = (
      listing: Listing
    ): PublicationWithProperty | undefined =>
      publicationBySourceExternalId.get(
        `${listing.source}:${listing.externalId}`
      ) ?? publicationByUrl.get(listing.url);

    for (const { listing, propertyKey, scrapedAt } of enriched) {
      const existingPublication = findExistingPublication(listing);

      if (existingPublication) {
        const property = existingPublication.property;
        const propertyChanged = hasPropertyChanges(property, listing);
        const scrapedAtChanged =
          existingPublication.scrapedAt.getTime() !== scrapedAt.getTime();

        if (!existingPublication.isActive) {
          publicationReactivateById.add(existingPublication.id);
        }

        if (!propertyChanged && !scrapedAtChanged) {
          result.skipped++;
          continue;
        }

        if (propertyChanged) {
          propertyUpdatesById.set(property.id, listing);
        }
        if (scrapedAtChanged) {
          publicationScrapedAtById.set(existingPublication.id, scrapedAt);
        }

        result.updated++;
        if (
          propertyChanged &&
          isPriceDrop(property.price, listing.price, property.firstPrice)
        ) {
          priceDropPropertyIds.add(property.id);
        }
        continue;
      }

      const pendingCreate = pendingPropertyCreates.get(propertyKey);
      if (pendingCreate) {
        mergeIntoPendingCreate(pendingCreate, listing, scrapedAt);
        result.linked++;
        continue;
      }

      const existingProperty = propertyByKey.get(propertyKey);
      if (existingProperty) {
        linkedPublications.push({
          propertyId: existingProperty.id,
          listing,
          scrapedAt,
        });

        if (hasPropertyChanges(existingProperty, listing)) {
          propertyUpdatesById.set(existingProperty.id, listing);
          if (
            isPriceDrop(
              existingProperty.price,
              listing.price,
              existingProperty.firstPrice
            )
          ) {
            priceDropPropertyIds.add(existingProperty.id);
          }
        }

        result.linked++;
        continue;
      }

      const postalCandidates = listing.postalCode
        ? (propertiesByPostalCode.get(listing.postalCode) ?? [])
        : [];
      const matchedProperty = findPropertyMatchForListing(
        listing,
        postalCandidates
      );
      if (matchedProperty) {
        linkedPublications.push({
          propertyId: matchedProperty.id,
          listing,
          scrapedAt,
        });

        if (hasPropertyChanges(matchedProperty, listing)) {
          propertyUpdatesById.set(matchedProperty.id, listing);
          if (
            isPriceDrop(
              matchedProperty.price,
              listing.price,
              matchedProperty.firstPrice
            )
          ) {
            priceDropPropertyIds.add(matchedProperty.id);
          }
        }

        result.linked++;
        continue;
      }

      pendingPropertyCreates.set(propertyKey, {
        listing,
        scrapedAt,
        extraPublications: [],
      });
      result.inserted++;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const [propertyId, listing] of propertyUpdatesById) {
        await tx.property.update({
          where: { id: propertyId },
          data: toPropertyData(listing),
        });
      }

      for (const publicationId of publicationReactivateById) {
        await tx.listingPublication.update({
          where: { id: publicationId },
          data: { isActive: true },
        });
      }

      for (const [publicationId, nextScrapedAt] of publicationScrapedAtById) {
        await tx.listingPublication.update({
          where: { id: publicationId },
          data: { scrapedAt: nextScrapedAt },
        });
      }

      for (const [propertyKey, pending] of pendingPropertyCreates) {
        const row = await tx.property.create({
          data: {
            propertyKey,
            ...toPropertyData(pending.listing),
            firstPrice: pending.listing.price,
            firstSeenAt: pending.scrapedAt,
            publications: {
              create: pendingPublicationsToCreate(pending),
            },
          },
        });
        insertedPropertyIds.push(row.id);
      }

      for (const link of linkedPublications) {
        await tx.listingPublication.create({
          data: {
            propertyId: link.propertyId,
            ...toPublicationCreateData(link.listing, link.scrapedAt),
          },
        });
      }
    });

    const idsToRefresh = [
      ...new Set([...insertedPropertyIds, ...priceDropPropertyIds]),
    ];
    const refreshedById = new Map(
      (idsToRefresh.length > 0 ? await this.findByIds(idsToRefresh) : []).map(
        (row) => [row.id, row]
      )
    );

    return {
      ...result,
      insertedListings: insertedPropertyIds
        .map((id) => refreshedById.get(id))
        .filter((row): row is PropertyRow => row !== undefined),
      priceDropListings: [...priceDropPropertyIds]
        .map((id) => refreshedById.get(id))
        .filter((row): row is PropertyRow => row !== undefined),
      errors: [],
    };
  }

  async deactivateMissingPublications(
    source: ListingSource,
    listings: Pick<Listing, "source" | "externalId" | "url">[]
  ): Promise<number> {
    const activeKeys = new Set(
      listings.map((listing) => publicationKey(listing))
    );
    const activeUrls = new Set(listings.map((listing) => listing.url));

    const publications = await this.prisma.listingPublication.findMany({
      where: { source, isActive: true },
      select: { id: true, externalId: true, url: true },
    });

    const idsToDeactivate = publications
      .filter(
        (publication) =>
          !activeKeys.has(`${source}:${publication.externalId}`) &&
          !activeUrls.has(publication.url)
      )
      .map((publication) => publication.id);

    if (idsToDeactivate.length === 0) {
      return 0;
    }

    let deactivated = 0;
    for (const idBatch of chunk(idsToDeactivate, IN_QUERY_BATCH_SIZE)) {
      const result = await this.prisma.listingPublication.updateMany({
        where: { id: { in: idBatch } },
        data: { isActive: false },
      });
      deactivated += result.count;
    }

    return deactivated;
  }

  async findRecent(limit = 10): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
      where: { publications: { some: { isActive: true } } },
      include: propertyInclude,
      orderBy: { firstSeenAt: "desc" },
      take: limit,
    });
    return rows.map(toPropertyRow);
  }

  async search(filters: ListingSearchFilters): Promise<PropertyRow[]> {
    const geoFilter = resolveGeoFilter(filters, true);
    const useGeoFilter = geoFilter.mode !== "city";

    let radiusFilter: { center: GeoPoint; radiusKm: number } | null = null;

    if (useGeoFilter) {
      if (!filters.city) return [];
      const searchCenter = await resolveGeoSearchCenter(filters.city);
      if (!searchCenter) return [];
      radiusFilter = resolveRadiusSearchFilter(geoFilter, searchCenter.center);
    }

    const textFilter = filters.text?.trim();
    const priceFilter =
      filters.minPrice !== undefined || filters.maxPrice !== undefined
        ? {
            ...(filters.minPrice !== undefined
              ? { gte: filters.minPrice }
              : {}),
            ...(filters.maxPrice !== undefined
              ? { lte: filters.maxPrice }
              : {}),
          }
        : undefined;

    const rows = await this.prisma.property.findMany({
      where: {
        city:
          filters.city && !useGeoFilter
            ? { contains: filters.city }
            : undefined,
        postalCode: filters.postalCode
          ? { contains: filters.postalCode }
          : undefined,
        price: priceFilter,
        surface:
          filters.minSurface !== undefined
            ? { gte: filters.minSurface }
            : undefined,
        landSurface:
          filters.minLandSurface !== undefined
            ? { gte: filters.minLandSurface }
            : undefined,
        rooms:
          filters.minRooms !== undefined
            ? { gte: filters.minRooms }
            : undefined,
        bedrooms:
          filters.minBedrooms !== undefined
            ? { gte: filters.minBedrooms }
            : undefined,
        isNewProperty: filters.neufOnly
          ? true
          : filters.ancienOnly
            ? { not: true }
            : undefined,
        publications: filters.source
          ? { some: { source: filters.source, isActive: true } }
          : { some: { isActive: true } },
        ...(textFilter
          ? {
              OR: [
                { title: { contains: textFilter } },
                { description: { contains: textFilter } },
              ],
            }
          : {}),
        ...(radiusFilter
          ? (() => {
              const bounds = boundingBoxForRadiusKm(
                radiusFilter.center,
                radiusFilter.radiusKm
              );
              return {
                latitude: {
                  not: null,
                  gte: bounds.minLat,
                  lte: bounds.maxLat,
                },
                longitude: {
                  not: null,
                  gte: bounds.minLng,
                  lte: bounds.maxLng,
                },
              };
            })()
          : {}),
      },
      include: propertyInclude,
      orderBy: searchOrderBy(filters.sort),
    });

    let results = rows.map(toPropertyRow);

    if (radiusFilter) {
      const { center, radiusKm } = radiusFilter;
      results = results.filter((property) => {
        if (property.latitude === null || property.longitude === null)
          return false;
        return isWithinRadiusKm(
          { lat: property.latitude, lng: property.longitude },
          center,
          radiusKm
        );
      });

      results.sort((a, b) => {
        if (
          a.latitude === null ||
          a.longitude === null ||
          b.latitude === null ||
          b.longitude === null
        ) {
          return 0;
        }
        const distA = haversineDistanceKm(
          center.lat,
          center.lng,
          a.latitude,
          a.longitude
        );
        const distB = haversineDistanceKm(
          center.lat,
          center.lng,
          b.latitude,
          b.longitude
        );
        return distA - distB;
      });
    }

    return results.slice(0, filters.limit ?? 10);
  }

  async count(): Promise<number> {
    return this.prisma.property.count();
  }

  async countPublications(): Promise<number> {
    return this.prisma.listingPublication.count({
      where: { isActive: true },
    });
  }

  async countActiveProperties(): Promise<number> {
    return this.prisma.property.count({
      where: { publications: { some: { isActive: true } } },
    });
  }

  async countInactivePublications(): Promise<number> {
    return this.prisma.listingPublication.count({
      where: { isActive: false },
    });
  }

  async getPublicationCountsBySource(): Promise<SourcePublicationCounts> {
    const rows = await this.prisma.listingPublication.groupBy({
      by: ["source", "isActive"],
      _count: { _all: true },
    });

    const counts: SourcePublicationCounts = {
      bienici: { active: 0, inactive: 0 },
      seloger: { active: 0, inactive: 0 },
      leboncoin: { active: 0, inactive: 0 },
    };

    for (const row of rows) {
      const bucket = row.isActive ? "active" : "inactive";
      counts[row.source][bucket] = row._count._all;
    }

    return counts;
  }

  async countPriceDrops(): Promise<number> {
    const result = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM properties p
      WHERE p.price < p.first_price
        AND EXISTS (
          SELECT 1
          FROM listing_publications lp
          WHERE lp.property_id = p.id
            AND lp.is_active = 1
        )
    `;

    return Number(result[0].count);
  }

  async getPriceStats(): Promise<PriceStats | null> {
    const rows = await this.prisma.$queryRaw<{ price: number }[]>`
      SELECT p.price AS price
      FROM properties p
      WHERE EXISTS (
        SELECT 1
        FROM listing_publications lp
        WHERE lp.property_id = p.id
          AND lp.is_active = 1
      )
      ORDER BY p.price ASC
    `;

    if (rows.length === 0) return null;

    const prices = rows.map((row) => row.price);
    const sum = prices.reduce((total, price) => total + price, 0);
    const mid = Math.floor(prices.length / 2);

    const min = prices[0];
    const max = prices[prices.length - 1];

    return {
      count: prices.length,
      min,
      max,
      median:
        prices.length % 2 === 0
          ? Math.round((prices[mid - 1] + prices[mid]) / 2)
          : prices[mid],
      average: Math.round(sum / prices.length),
    };
  }

  async findPriceDrops(limit = 5): Promise<PropertyRow[]> {
    const rows = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT p.id AS id
      FROM properties p
      WHERE p.price < p.first_price
        AND EXISTS (
          SELECT 1
          FROM listing_publications lp
          WHERE lp.property_id = p.id
            AND lp.is_active = 1
        )
      ORDER BY (p.first_price - p.price) DESC
      LIMIT ${limit}
    `;

    if (rows.length === 0) return [];

    const properties = await this.prisma.property.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      include: propertyInclude,
    });

    const byId = new Map(properties.map((property) => [property.id, property]));

    return rows
      .map((row) => byId.get(row.id))
      .filter((property): property is NonNullable<typeof property> =>
        Boolean(property)
      )
      .map(toPropertyRow);
  }

  async getTopCities(limit = 5): Promise<CityCount[]> {
    const rows = await this.prisma.property.groupBy({
      by: ["city"],
      where: { publications: { some: { isActive: true } } },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } },
      take: limit,
    });

    return rows.map((row) => ({
      city: row.city,
      count: row._count._all,
    }));
  }

  async getActivityStats(): Promise<ActivityStats> {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [lastScrape, addedLast7Days, deactivatedLast7Days, multiSource] =
      await Promise.all([
        this.prisma.listingPublication.aggregate({
          _max: { scrapedAt: true },
        }),
        this.prisma.property.count({
          where: { firstSeenAt: { gte: since } },
        }),
        this.prisma.listingPublication.count({
          where: { isActive: false, updatedAt: { gte: since } },
        }),
        this.prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*) AS count
          FROM (
            SELECT property_id
            FROM listing_publications
            WHERE is_active = 1
            GROUP BY property_id
            HAVING COUNT(DISTINCT source) > 1
          )
        `,
      ]);

    return {
      lastScrapedAt: lastScrape._max.scrapedAt,
      addedLast7Days,
      deactivatedLast7Days,
      multiSourceCount: Number(multiSource[0].count),
    };
  }

  async findById(id: number): Promise<PropertyRow | undefined> {
    const row = await this.prisma.property.findUnique({
      where: { id },
      include: propertyInclude,
    });
    return row ? toPropertyRow(row) : undefined;
  }

  async applyEnrichment(
    id: number,
    patch: PropertyEnrichmentPatch
  ): Promise<PropertyRow | undefined> {
    if (Object.keys(patch).length === 0) {
      return this.findById(id);
    }

    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: patch,
        include: propertyInclude,
      });
      return toPropertyRow(row);
    } catch (error) {
      log.warn(
        `Enrichissement property ${String(id)}: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  async updateAddress(
    id: number,
    address: string,
    dpeNumero: string | null
  ): Promise<PropertyRow | undefined> {
    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: { address, dpeNumero },
        include: propertyInclude,
      });
      return toPropertyRow(row);
    } catch (error) {
      log.warn(
        `Mise à jour adresse property ${String(id)}: ${error instanceof Error ? error.message : String(error)}`
      );
      return undefined;
    }
  }

  async findByIds(ids: number[]): Promise<PropertyRow[]> {
    if (ids.length === 0) return [];

    const byId = new Map<number, PropertyWithPublications>();
    for (const idBatch of chunk(ids, IN_QUERY_BATCH_SIZE)) {
      const rows = await this.prisma.property.findMany({
        where: { id: { in: idBatch } },
        include: propertyInclude,
      });
      for (const row of rows) {
        byId.set(row.id, row);
      }
    }

    return ids
      .map((id) => byId.get(id))
      .filter((row): row is PropertyWithPublications => row !== undefined)
      .map(toPropertyRow);
  }
}
