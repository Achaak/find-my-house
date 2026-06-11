import type {
  ListingPublication as PrismaPublication,
  PrismaClient,
  Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type {
  ExtendedScrapeResult,
  Listing,
  ListingSearchFilters,
  PropertyRow,
  ScrapeResult,
  UpsertStatus,
} from "../types/listing.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import { toPropertyRow } from "./listingMapper.js";
import {
  haversineDistanceKm,
  isWithinRadiusKm,
  type GeoPoint,
} from "../utils/geo.js";
import {
  resolveGeoFilter,
  resolveRadiusSearchFilter,
} from "../utils/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geocode.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const propertyInclude = { publications: true } as const;

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

  async upsert(listing: Listing): Promise<{
    status: UpsertStatus;
    row?: PropertyRow;
    priceDropped?: boolean;
  }> {
    const propertyKey = computePropertyKey(listing);
    const scrapedAt = new Date(listing.scrapedAt);

    const existingPublication = await this.prisma.listingPublication.findFirst({
      where: {
        OR: [
          { source: listing.source, externalId: listing.externalId },
          { url: listing.url },
        ],
      },
      include: { property: { include: propertyInclude } },
    });

    if (existingPublication) {
      const property = existingPublication.property;
      const propertyChanged = hasPropertyChanges(property, listing);
      const scrapedAtChanged =
        existingPublication.scrapedAt.getTime() !== scrapedAt.getTime();

      if (!propertyChanged && !scrapedAtChanged) {
        return { status: "skipped" };
      }

      if (propertyChanged) {
        await this.prisma.property.update({
          where: { id: property.id },
          data: toPropertyData(listing),
        });
      }

      if (scrapedAtChanged) {
        await this.prisma.listingPublication.update({
          where: { id: existingPublication.id },
          data: { scrapedAt },
        });
      }

      const row = await this.prisma.property.findUniqueOrThrow({
        where: { id: property.id },
        include: propertyInclude,
      });
      const priceDropped =
        propertyChanged &&
        isPriceDrop(property.price, listing.price, property.firstPrice);
      return { status: "updated", row: toPropertyRow(row), priceDropped };
    }

    const existingProperty = await this.prisma.property.findUnique({
      where: { propertyKey },
      include: propertyInclude,
    });

    if (existingProperty) {
      await this.prisma.listingPublication.create({
        data: {
          propertyId: existingProperty.id,
          externalId: listing.externalId,
          source: listing.source,
          url: listing.url,
          scrapedAt,
        },
      });

      const propertyChanged = hasPropertyChanges(existingProperty, listing);
      if (propertyChanged) {
        await this.prisma.property.update({
          where: { id: existingProperty.id },
          data: toPropertyData(listing),
        });
      }

      const row = await this.prisma.property.findUniqueOrThrow({
        where: { id: existingProperty.id },
        include: propertyInclude,
      });
      const priceDropped =
        propertyChanged &&
        isPriceDrop(
          existingProperty.price,
          listing.price,
          existingProperty.firstPrice
        );
      return { status: "linked", row: toPropertyRow(row), priceDropped };
    }

    const row = await this.prisma.property.create({
      data: {
        propertyKey,
        ...toPropertyData(listing),
        firstPrice: listing.price,
        firstSeenAt: scrapedAt,
        publications: {
          create: {
            externalId: listing.externalId,
            source: listing.source,
            url: listing.url,
            scrapedAt,
          },
        },
      },
      include: propertyInclude,
    });
    return { status: "inserted", row: toPropertyRow(row) };
  }

  async upsertMany(listings: Listing[]): Promise<ExtendedScrapeResult> {
    if (listings.length === 0) {
      return {
        found: 0,
        inserted: 0,
        linked: 0,
        updated: 0,
        skipped: 0,
        insertedListings: [],
        priceDropListings: [],
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

    const [existingPublications, existingProperties] = await Promise.all([
      this.prisma.listingPublication.findMany({
        where: {
          OR: [
            ...listings.map((listing) => ({
              source: listing.source,
              externalId: listing.externalId,
            })),
            ...listings.map((listing) => ({ url: listing.url })),
          ],
        },
        include: { property: { include: propertyInclude } },
      }),
      this.prisma.property.findMany({
        where: { propertyKey: { in: propertyKeys } },
        include: propertyInclude,
      }),
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

    const result: ScrapeResult = {
      found: listings.length,
      inserted: 0,
      linked: 0,
      updated: 0,
      skipped: 0,
    };
    const propertyUpdatesById = new Map<number, Listing>();
    const publicationScrapedAtById = new Map<number, Date>();
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
        pendingCreate.extraPublications.push({ listing, scrapedAt });
        if (hasPropertyChanges(pendingCreate.listing, listing)) {
          pendingCreate.listing = listing;
        }
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
              create: [
                {
                  externalId: pending.listing.externalId,
                  source: pending.listing.source,
                  url: pending.listing.url,
                  scrapedAt: pending.scrapedAt,
                },
                ...pending.extraPublications.map((publication) => ({
                  externalId: publication.listing.externalId,
                  source: publication.listing.source,
                  url: publication.listing.url,
                  scrapedAt: publication.scrapedAt,
                })),
              ],
            },
          },
        });
        insertedPropertyIds.push(row.id);
      }

      for (const link of linkedPublications) {
        await tx.listingPublication.create({
          data: {
            propertyId: link.propertyId,
            externalId: link.listing.externalId,
            source: link.listing.source,
            url: link.listing.url,
            scrapedAt: link.scrapedAt,
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
    };
  }

  async markNotified(propertyIds: number[]): Promise<void> {
    if (propertyIds.length === 0) return;

    await this.prisma.property.updateMany({
      where: { id: { in: propertyIds } },
      data: { notifiedAt: new Date() },
    });
  }

  async findRecent(limit = 10): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
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
          ? { some: { source: filters.source } }
          : undefined,
        ...(textFilter
          ? {
              OR: [
                { title: { contains: textFilter } },
                { description: { contains: textFilter } },
              ],
            }
          : {}),
        latitude: radiusFilter ? { not: null } : undefined,
        longitude: radiusFilter ? { not: null } : undefined,
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
    return this.prisma.listingPublication.count();
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
      console.warn(
        `[db] Enrichissement property ${String(id)}:`,
        error instanceof Error ? error.message : String(error)
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
      console.warn(
        `[db] Mise à jour adresse property ${String(id)}:`,
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  async findByIds(ids: number[]): Promise<PropertyRow[]> {
    if (ids.length === 0) return [];

    const rows = await this.prisma.property.findMany({
      where: { id: { in: ids } },
      include: propertyInclude,
      orderBy: { firstSeenAt: "desc" },
    });
    return rows.map(toPropertyRow);
  }
}
