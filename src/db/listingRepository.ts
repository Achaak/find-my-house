import type { PrismaClient } from "../generated/prisma/client.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { RepositoryWriteResult } from "../types/db.js";
import { repositoryWriteError } from "../types/db.js";
import { displayEnrichmentPendingWhere } from "../domain/enrichmentCriteria.js";
import { toPropertyRow } from "./listingMapper.js";
import { propertyInclude } from "./propertyInclude.js";
import { PropertySearchRepository } from "./propertySearchRepository.js";
import { PropertyStatsRepository } from "./propertyStatsRepository.js";
import { PublicationUpsertRepository } from "./publicationUpsertRepository.js";
import { createLogger } from "../utils/logger.js";
import {
  reconcileProperties,
  reconcilePropertiesInPostalCodes,
} from "../services/reconcileService.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import { ProjectionUpdater } from "./projectionUpdater.js";
import { toPrismaPropertyPatch } from "./propertyWriteData.js";

const log = createLogger("db");

function toPrismaEnrichmentPatch(patch: PropertyEnrichmentPatch) {
  return toPrismaPropertyPatch(patch);
}

export class ListingRepository {
  private readonly searchRepo: PropertySearchRepository;
  private readonly statsRepo: PropertyStatsRepository;
  private readonly upsertRepo: PublicationUpsertRepository;
  private readonly projectionUpdater: ProjectionUpdater;

  constructor(private readonly prisma: PrismaClient) {
    this.searchRepo = new PropertySearchRepository(prisma);
    this.statsRepo = new PropertyStatsRepository(prisma);
    this.projectionUpdater = new ProjectionUpdater(prisma);
    this.upsertRepo = new PublicationUpsertRepository(prisma, (ids) =>
      this.searchRepo.findByIds(ids)
    );
  }

  upsert(...args: Parameters<PublicationUpsertRepository["upsert"]>) {
    return this.upsertRepo.upsert(...args);
  }

  upsertMany(...args: Parameters<PublicationUpsertRepository["upsertMany"]>) {
    return this.upsertRepo.upsertMany(...args);
  }

  deactivateMissingPublications(
    ...args: Parameters<
      PublicationUpsertRepository["deactivateMissingPublications"]
    >
  ) {
    return this.upsertRepo.deactivateMissingPublications(...args);
  }

  async findRecent(limit = 10): Promise<PropertyRow[]> {
    return this.searchRepo.findRecent(limit);
  }

  async search(
    filters: ListingSearchFilters
  ): Promise<{ items: PropertyRow[]; total: number }> {
    return this.searchRepo.search(filters);
  }

  async findAddedSince(since: Date, limit = 20): Promise<PropertyRow[]> {
    return this.searchRepo.findAddedSince(since, limit);
  }

  async count(): Promise<number> {
    return this.statsRepo.count();
  }

  async countPublications(): Promise<number> {
    return this.statsRepo.countPublications();
  }

  async countActiveProperties(): Promise<number> {
    return this.statsRepo.countActiveProperties();
  }

  async countPendingDisplayEnrichment(): Promise<number> {
    return this.statsRepo.countPendingDisplayEnrichment();
  }

  async countInactivePublications(): Promise<number> {
    return this.statsRepo.countInactivePublications();
  }

  async getPublicationCountsBySource(): Promise<SourcePublicationCounts> {
    return this.statsRepo.getPublicationCountsBySource();
  }

  async countPriceDrops(): Promise<number> {
    return this.statsRepo.countPriceDrops();
  }

  async getPriceStats(): Promise<PriceStats | null> {
    return this.statsRepo.getPriceStats();
  }

  async findPriceDrops(limit = 5): Promise<PropertyRow[]> {
    return this.statsRepo.findPriceDrops(limit);
  }

  async getTopCities(limit = 5): Promise<CityCount[]> {
    return this.statsRepo.getTopCities(limit);
  }

  async getActivityStats(): Promise<ActivityStats> {
    return this.statsRepo.getActivityStats();
  }

  async findById(id: number): Promise<PropertyRow | undefined> {
    return this.searchRepo.findById(id);
  }

  async findPropertiesForEnrichmentScan(limit: number): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
      where: displayEnrichmentPendingWhere(),
      take: limit,
      orderBy: { firstSeenAt: "asc" },
      include: propertyInclude,
    });
    return rows.map(toPropertyRow);
  }

  async applyEnrichment(
    id: number,
    patch: PropertyEnrichmentPatch
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    if (Object.keys(patch).length === 0) {
      const row = await this.findById(id);
      return row ? { ok: true, value: row } : { ok: false, error: "Not found" };
    }

    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: toPrismaEnrichmentPatch(patch),
        include: propertyInclude,
      });
      return { ok: true, value: toPropertyRow(row) };
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(`Enrichissement property ${String(id)}: ${message}`);
      return { ok: false, error: message };
    }
  }

  async applyPublicationEnrichment(
    publicationId: number,
    patch: PropertyEnrichmentPatch
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    try {
      const publication = await this.prisma.listingPublication.update({
        where: { id: publicationId },
        data: toPrismaEnrichmentPatch(patch),
        select: { propertyId: true },
      });
      return await this.refreshPropertyProjection(publication.propertyId);
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(
        `Enrichissement publication ${String(publicationId)}: ${message}`
      );
      return { ok: false, error: message };
    }
  }

  async markEnrichmentAttempted(
    id: number,
    purpose: "display" | "address"
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    const data =
      purpose === "display"
        ? { displayEnrichedAt: new Date() }
        : { addressEnrichedAt: new Date() };

    try {
      const row = await this.prisma.property.update({
        where: { id },
        data,
        include: propertyInclude,
      });
      return { ok: true, value: toPropertyRow(row) };
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(
        `Enrichment attempt marker ${String(id)} (${purpose}): ${message}`
      );
      return { ok: false, error: message };
    }
  }

  async markPublicationEnrichmentAttempted(
    publicationId: number,
    purpose: "display" | "address"
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    const data =
      purpose === "display"
        ? { displayEnrichedAt: new Date() }
        : { addressEnrichedAt: new Date() };

    try {
      const publication = await this.prisma.listingPublication.update({
        where: { id: publicationId },
        data,
        select: { propertyId: true },
      });
      return await this.refreshPropertyProjection(publication.propertyId);
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(
        `Publication enrichment marker ${String(publicationId)} (${purpose}): ${message}`
      );
      return { ok: false, error: message };
    }
  }

  async updateAddress(
    id: number,
    address: string,
    dpeNumero: string | null
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: { address, dpeNumero },
        include: propertyInclude,
      });
      return { ok: true, value: toPropertyRow(row) };
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(`Property address update ${String(id)}: ${message}`);
      return { ok: false, error: message };
    }
  }

  async findByIds(ids: number[]): Promise<PropertyRow[]> {
    return this.searchRepo.findByIds(ids);
  }

  async refreshPropertyProjection(
    propertyId: number
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    const result = await this.projectionUpdater.refresh(propertyId);
    if (!result.ok) {
      log.warn(
        `Property projection refresh ${String(propertyId)}: ${result.error}`
      );
    }
    return result;
  }

  async reconcileDuplicates(postalCodes?: string[]): Promise<ReconcileResult> {
    if (postalCodes && postalCodes.length > 0) {
      const partial = await reconcilePropertiesInPostalCodes(
        this.prisma,
        postalCodes
      );
      const unique = await this.prisma.property.count();
      return {
        ...partial,
        unique,
        agencyFieldsUpdated: 0,
      };
    }

    return reconcileProperties(this.prisma);
  }
}
