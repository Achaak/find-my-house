import type { Listing as PrismaListing, PrismaClient } from "../generated/prisma/client.js";
import type { Listing, ListingRow, ScrapeResult } from "../types/listing.js";

function toListingRow(row: PrismaListing): ListingRow {
  return {
    id: row.id,
    externalId: row.externalId,
    source: row.source as ListingRow["source"],
    title: row.title,
    price: row.price,
    surface: row.surface,
    rooms: row.rooms,
    city: row.city,
    postalCode: row.postalCode,
    url: row.url,
    description: row.description,
    imageUrl: row.imageUrl,
    propertyType: row.propertyType,
    scrapedAt: row.scrapedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCreateData(listing: Listing) {
  return {
    externalId: listing.externalId,
    source: listing.source,
    title: listing.title,
    price: listing.price,
    surface: listing.surface,
    rooms: listing.rooms,
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
      select: { id: true, price: true, title: true },
    });

    if (!existing) {
      const row = await this.prisma.listing.create({ data: toCreateData(listing) });
      return { status: "inserted", row: toListingRow(row) };
    }

    const hasChanges =
      existing.price !== listing.price || existing.title !== listing.title;

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

  async search(filters: {
    city?: string;
    maxPrice?: number;
    minSurface?: number;
    limit?: number;
  }): Promise<ListingRow[]> {
    const rows = await this.prisma.listing.findMany({
      where: {
        city: filters.city ? { contains: filters.city } : undefined,
        price: filters.maxPrice !== undefined ? { lte: filters.maxPrice } : undefined,
        surface:
          filters.minSurface !== undefined
            ? { gte: filters.minSurface }
            : undefined,
      },
      orderBy: { price: "asc" },
      take: filters.limit ?? 10,
    });
    return rows.map(toListingRow);
  }

  async count(): Promise<number> {
    return this.prisma.listing.count();
  }

  async findById(id: number): Promise<ListingRow | undefined> {
    const row = await this.prisma.listing.findUnique({ where: { id } });
    return row ? toListingRow(row) : undefined;
  }
}
