import { type PrismaClient, Prisma } from "../generated/prisma/client.js";
import { computePropertyProjection } from "../domain/propertyProjection.js";
import { propertyInclude } from "./propertyInclude.js";
import { tryToPropertyRow } from "./listingMapper.js";
import type { PropertyRow } from "../types/listing.js";
import type { RepositoryWriteResult } from "../types/db.js";
import { repositoryWriteError } from "../types/db.js";
import { toPrismaSearchCacheData } from "./propertyWriteData.js";

type ProjectionClient = PrismaClient | Prisma.TransactionClient;

export class ProjectionUpdater {
  constructor(private readonly prisma: PrismaClient) {}

  async refresh(
    propertyId: number,
    tx?: Prisma.TransactionClient
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    try {
      const client: ProjectionClient = tx ?? this.prisma;
      const row = await client.property.findUnique({
        where: { id: propertyId },
        include: propertyInclude,
      });
      if (!row) return { ok: false, error: "Not found" };

      const projection = computePropertyProjection(row.publications);
      if (!projection) {
        if (row.publications.length === 0) {
          return { ok: false, error: "No publications found" };
        }
        const property = tryToPropertyRow(row);
        return property
          ? { ok: true, value: property }
          : { ok: false, error: "No publications found" };
      }

      const updated = await client.property.update({
        where: { id: propertyId },
        data: {
          ...toPrismaSearchCacheData(projection),
          hasPriceDrop: row.firstPrice > projection.price,
        },
        include: propertyInclude,
      });

      const property = tryToPropertyRow(updated);
      return property
        ? { ok: true, value: property }
        : { ok: false, error: "No publications found" };
    } catch (error) {
      return { ok: false, error: repositoryWriteError(error) };
    }
  }

  async refreshMany(
    propertyIds: Iterable<number>,
    tx?: Prisma.TransactionClient
  ): Promise<RepositoryWriteResult<PropertyRow>[]> {
    const results: RepositoryWriteResult<PropertyRow>[] = [];
    for (const propertyId of propertyIds) {
      results.push(await this.refresh(propertyId, tx));
    }
    return results;
  }
}
