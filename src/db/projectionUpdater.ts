import { type PrismaClient, Prisma } from "../generated/prisma/client.js";
import { computePropertyProjection } from "../domain/propertyProjection.js";
import { propertyInclude } from "./propertyInclude.js";
import { toPropertyRow } from "./listingMapper.js";
import type { PropertyRow } from "../types/listing.js";
import type { RepositoryWriteResult } from "../types/db.js";
import { repositoryWriteError } from "../types/db.js";
import { toPrismaProjectionData } from "./propertyWriteData.js";

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
        return { ok: true, value: toPropertyRow(row) };
      }

      const updated = await client.property.update({
        where: { id: propertyId },
        data: {
          ...toPrismaProjectionData(projection),
          hasPriceDrop: row.firstPrice > projection.price,
        },
        include: propertyInclude,
      });

      return { ok: true, value: toPropertyRow(updated) };
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
