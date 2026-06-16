import type { PrismaClient } from "../generated/prisma/client.js";
import { Prisma } from "../generated/prisma/client.js";
import type {
  AdminDiagnosticItem,
  DiagnosticsQuery,
  ListingSource,
  PropertyMatchDiagnosticsPage,
  PropertyMatchNearMiss,
} from "@find-my-house/api-types";

export type PropertyMatchDiagnosticsFilters = Omit<
  DiagnosticsQuery,
  "limit" | "from" | "to"
> & {
  source?: ListingSource;
  from?: Date;
  to?: Date;
};

export class PropertyMatchDiagnosticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecent(
    limit = 50,
    filters: PropertyMatchDiagnosticsFilters = {}
  ): Promise<PropertyMatchDiagnosticsPage> {
    const clampedLimit = Math.max(1, Math.min(limit, 500));
    let rows;
    try {
      rows = await this.prisma.propertyMatchDiagnostic.findMany({
        where: {
          ...(filters.source ? { listingSource: filters.source } : {}),
          ...(filters.postalCode ? { postalCode: filters.postalCode } : {}),
          ...(filters.bestVeto ? { bestVeto: filters.bestVeto } : {}),
          ...(filters.beforeId ? { id: { lt: filters.beforeId } } : {}),
          ...((filters.from ?? filters.to) !== undefined && {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }),
        },
        orderBy: { createdAt: "desc" },
        take: clampedLimit + 1,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2021"
      ) {
        return { items: [], nextBeforeId: null };
      }
      throw error;
    }
    const pagedRows = rows.slice(0, clampedLimit);
    const items: AdminDiagnosticItem[] = pagedRows.map((row) => ({
      id: row.id,
      listingSource: row.listingSource,
      listingExternalId: row.listingExternalId,
      postalCode: row.postalCode,
      threshold: row.threshold,
      bestScore: row.bestScore,
      bestCandidateId: row.bestCandidateId,
      bestVeto: row.bestVeto,
      nearMisses: row.nearMisses as PropertyMatchNearMiss[],
      createdAt: row.createdAt.toISOString(),
    }));
    const lastPagedRow = pagedRows.at(-1);
    const nextBeforeId =
      rows.length > clampedLimit && lastPagedRow ? lastPagedRow.id : null;
    return { items, nextBeforeId };
  }
}
