import {
  Prisma,
  type ListingPublication as PrismaPublication,
  type PrismaClient,
  type Property as PrismaProperty,
} from "../generated/prisma/client.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import { propertyInclude } from "./propertyInclude.js";
import { toPropertyRow } from "./listingMapper.js";
import {
  boundingBoxForRadiusKm,
  haversineDistanceKm,
  isWithinRadiusKm,
  type GeoPoint,
} from "../utils/geo/geo.js";
import {
  resolveGeoFilter,
  resolveRadiusSearchFilter,
} from "../utils/geo/geoFilter.js";
import { resolveGeoSearchCenter } from "../utils/geo/geocode.js";

type PropertyWithPublications = PrismaProperty & {
  publications: PrismaPublication[];
};

const IN_QUERY_BATCH_SIZE = 900;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

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

function buildPropertySearchWhere(
  filters: ListingSearchFilters,
  useGeoFilter: boolean,
  radiusFilter: { center: GeoPoint; radiusKm: number } | null
): Prisma.PropertyWhereInput {
  const textFilter = filters.text?.trim();
  const priceFilter =
    filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? {
          ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
          ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
        }
      : undefined;

  return {
    city:
      filters.city && !useGeoFilter ? { contains: filters.city } : undefined,
    postalCode:
      filters.postalCode && !useGeoFilter
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
      filters.minRooms !== undefined ? { gte: filters.minRooms } : undefined,
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
    reactions: filters.excludeReacted ? { none: {} } : undefined,
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
  };
}

function applyPriceDropWhere(
  where: Prisma.PropertyWhereInput
): Prisma.PropertyWhereInput {
  return { AND: [where, { hasPriceDrop: true }] };
}

function needsSearchPostProcessing(
  radiusFilter: { center: GeoPoint; radiusKm: number } | null
): boolean {
  return radiusFilter !== null;
}

export class PropertySearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecent(limit = 10): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
      where: { publications: { some: { isActive: true } } },
      include: propertyInclude,
      orderBy: { firstSeenAt: "desc" },
      take: limit,
    });
    return rows.map(toPropertyRow);
  }

  async search(
    filters: ListingSearchFilters
  ): Promise<{ items: PropertyRow[]; total: number }> {
    const geoFilter = resolveGeoFilter(filters, true);
    const useGeoFilter = geoFilter.mode !== "city";

    let radiusFilter: { center: GeoPoint; radiusKm: number } | null = null;

    if (useGeoFilter) {
      if (!filters.city) return { items: [], total: 0 };
      const searchCenter = await resolveGeoSearchCenter(
        filters.city,
        filters.postalCode
      );
      if (!searchCenter) return { items: [], total: 0 };
      radiusFilter = resolveRadiusSearchFilter(geoFilter, searchCenter.center);
    }

    let where = buildPropertySearchWhere(filters, useGeoFilter, radiusFilter);
    if (filters.priceDropOnly) {
      where = applyPriceDropWhere(where);
    }
    const orderBy = searchOrderBy(filters.sort);
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 10;

    if (!needsSearchPostProcessing(radiusFilter)) {
      const [total, rows] = await Promise.all([
        this.prisma.property.count({ where }),
        this.prisma.property.findMany({
          where,
          include: propertyInclude,
          orderBy,
          skip: offset,
          take: limit,
        }),
      ]);

      return { items: rows.map(toPropertyRow), total };
    }

    const leanRows = await this.prisma.property.findMany({
      where,
      select: { id: true, latitude: true, longitude: true },
    });

    if (!radiusFilter) {
      return { items: [], total: 0 };
    }

    const { center, radiusKm } = radiusFilter;
    const rankedIds = leanRows
      .filter((row) => {
        if (row.latitude === null || row.longitude === null) return false;
        return isWithinRadiusKm(
          { lat: row.latitude, lng: row.longitude },
          center,
          radiusKm
        );
      })
      .map((row) => ({
        id: row.id,
        distance: haversineDistanceKm(
          center.lat,
          center.lng,
          row.latitude,
          row.longitude
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    const total = rankedIds.length;
    const pageIds = rankedIds
      .slice(offset, offset + limit)
      .map((entry) => entry.id);

    if (pageIds.length === 0) {
      return { items: [], total };
    }

    const rows = await this.prisma.property.findMany({
      where: { id: { in: pageIds } },
      include: propertyInclude,
    });
    const rowsById = new Map(rows.map((row) => [row.id, row]));

    return {
      items: pageIds
        .map((id) => rowsById.get(id))
        .filter((row): row is PropertyWithPublications => row !== undefined)
        .map(toPropertyRow),
      total,
    };
  }

  async findAddedSince(since: Date, limit = 20): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
      where: {
        firstSeenAt: { gte: since },
        publications: { some: { isActive: true } },
      },
      include: propertyInclude,
      orderBy: { firstSeenAt: "desc" },
      take: limit,
    });
    return rows.map(toPropertyRow);
  }

  async findById(id: number): Promise<PropertyRow | undefined> {
    const row = await this.prisma.property.findUnique({
      where: { id },
      include: propertyInclude,
    });
    return row ? toPropertyRow(row) : undefined;
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
