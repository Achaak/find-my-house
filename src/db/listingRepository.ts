import type { PrismaClient } from "../generated/prisma/client.js";
import type {
  Listing,
  ListingRow,
  ListingSearchFilters,
  ScrapeResult,
} from "../types/listing.js";
import { toListingRow } from "./listingMapper.js";
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

function toCreateData(listing: Listing) {
  return {
    externalId: listing.externalId,
    source: listing.source,
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
    url: listing.url,
    description: listing.description,
    imageUrl: listing.imageUrl,
    propertyType: listing.propertyType,
    scrapedAt: new Date(listing.scrapedAt),
  };
}

export class ListingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(
    listing: Listing
  ): Promise<{ status: "inserted" | "updated" | "skipped"; row?: ListingRow }> {
    const existing = await this.prisma.listing.findFirst({
      where: {
        OR: [
          { source: listing.source, externalId: listing.externalId },
          { url: listing.url },
        ],
      },
    });

    if (!existing) {
      const row = await this.prisma.listing.create({
        data: toCreateData(listing),
      });
      return { status: "inserted", row: toListingRow(row) };
    }

    const hasChanges =
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
      existing.propertyType !== listing.propertyType;

    if (!hasChanges) {
      return { status: "skipped" };
    }

    const row = await this.prisma.listing.update({
      where: { id: existing.id },
      data: toCreateData(listing),
    });
    return { status: "updated", row: toListingRow(row) };
  }

  async upsertMany(
    listings: Listing[]
  ): Promise<ScrapeResult & { insertedListings: ListingRow[] }> {
    const result: ScrapeResult = {
      found: listings.length,
      inserted: 0,
      updated: 0,
      skipped: 0,
    };
    const insertedListings: ListingRow[] = [];

    await this.prisma.$transaction(async () => {
      for (const listing of listings) {
        const { status, row } = await this.upsert(listing);
        result[status]++;
        if (status === "inserted" && row) {
          insertedListings.push(row);
        }
      }
    });

    return { ...result, insertedListings };
  }

  async findRecent(limit = 10): Promise<ListingRow[]> {
    const rows = await this.prisma.listing.findMany({
      orderBy: { scrapedAt: "desc" },
      take: limit,
    });
    return rows.map(toListingRow);
  }

  async search(filters: ListingSearchFilters): Promise<ListingRow[]> {
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

    const rows = await this.prisma.listing.findMany({
      where: {
        city:
          filters.city && !useGeoFilter
            ? { contains: filters.city }
            : undefined,
        price:
          filters.maxPrice !== undefined
            ? { lte: filters.maxPrice }
            : undefined,
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
        isNewProperty: filters.ancienOnly ? { not: true } : undefined,
        latitude:
          center && geoFilter.mode === "radius" ? { not: null } : undefined,
        longitude:
          center && geoFilter.mode === "radius" ? { not: null } : undefined,
      },
      orderBy: { price: "asc" },
    });

    let results = rows.map(toListingRow);

    if (travelZoneExternalIds) {
      const externalIds = travelZoneExternalIds;
      results = results.filter(
        (listing) =>
          listing.source === "bienici" && externalIds.has(listing.externalId)
      );
    } else if (center && geoFilter.mode === "radius") {
      const radiusKm = geoFilter.radiusKm;
      results = results.filter((listing) => {
        if (listing.latitude === null || listing.longitude === null)
          return false;
        return isWithinRadiusKm(
          { lat: listing.latitude, lng: listing.longitude },
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
    return this.prisma.listing.count();
  }

  async findById(id: number): Promise<ListingRow | undefined> {
    const row = await this.prisma.listing.findUnique({ where: { id } });
    return row ? toListingRow(row) : undefined;
  }
}
