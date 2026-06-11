import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  Listing,
  ListingSearchFilters,
  PropertyRow,
  ScrapeResult,
  UpsertStatus,
} from "../types/listing.js";
import { toPropertyRow } from "./listingMapper.js";
import {
  buildBienIciSearchFilters,
  computeBienIciTravelZone,
  fetchBienIciExternalIds,
} from "../utils/bieniciApi.js";
import {
  haversineDistanceKm,
  isWithinRadiusKm,
  type GeoPoint,
} from "../utils/geo.js";
import { resolveGeoFilter } from "../utils/geoFilter.js";
import {
  resolveBienIciPlace,
  resolveBienIciTravelOrigin,
} from "../utils/geocode.js";
import { computePropertyKey } from "../utils/propertyKey.js";

const propertyInclude = { publications: true } as const;

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
    existing.gesClass !== listing.gesClass
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

  async upsertMany(listings: Listing[]): Promise<
    ScrapeResult & {
      insertedListings: PropertyRow[];
      priceDropListings: PropertyRow[];
    }
  > {
    const result: ScrapeResult = {
      found: listings.length,
      inserted: 0,
      linked: 0,
      updated: 0,
      skipped: 0,
    };
    const insertedListings: PropertyRow[] = [];
    const priceDropListings: PropertyRow[] = [];

    const insertedIds: number[] = [];
    const priceDropIds = new Set<number>();

    for (const listing of listings) {
      const { status, row, priceDropped } = await this.upsert(listing);
      result[status]++;
      if (status === "inserted" && row) {
        insertedIds.push(row.id);
      }
      if (priceDropped && row) {
        priceDropIds.add(row.id);
      }
    }

    if (insertedIds.length > 0) {
      const refreshed = await this.findByIds(insertedIds);
      insertedListings.push(...refreshed);
    }

    if (priceDropIds.size > 0) {
      const refreshed = await this.findByIds([...priceDropIds]);
      priceDropListings.push(...refreshed);
    }

    return { ...result, insertedListings, priceDropListings };
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

    let center: GeoPoint | null = null;
    let travelZoneExternalIds: Set<string> | null = null;

    if (useGeoFilter) {
      if (!filters.city) return [];
      const place = await resolveBienIciPlace(filters.city);
      if (!place) return [];
      center = place.center;

      if (geoFilter.mode === "travel") {
        const origin = (await resolveBienIciTravelOrigin(filters.city)) ?? {
          center,
          address: place.name,
        };
        const zoneId = await computeBienIciTravelZone({
          center: origin.center,
          address: origin.address,
          durationMinutes: geoFilter.maxTravelMinutes,
        });
        const apiFilters = buildBienIciSearchFilters(filters, {
          travelTimeZone: [zoneId],
        });
        travelZoneExternalIds = await fetchBienIciExternalIds(apiFilters);
      }
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
        latitude:
          center && geoFilter.mode === "radius" ? { not: null } : undefined,
        longitude:
          center && geoFilter.mode === "radius" ? { not: null } : undefined,
      },
      include: propertyInclude,
      orderBy: searchOrderBy(filters.sort),
    });

    let results = rows.map(toPropertyRow);

    if (travelZoneExternalIds) {
      const externalIds = travelZoneExternalIds;
      results = results.filter((property) =>
        property.publications.some(
          (publication) =>
            publication.source === "bienici" &&
            externalIds.has(publication.externalId)
        )
      );
    } else if (center && geoFilter.mode === "radius") {
      const radiusKm = geoFilter.radiusKm;
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
    } catch {
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
