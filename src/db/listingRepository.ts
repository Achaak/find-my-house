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
import { displayEnrichmentBackfillWhere } from "../services/enrichment/criteria.js";
import { Prisma } from "../generated/prisma/client.js";
import { tryToPropertyRow } from "./listingMapper.js";
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
import {
  filterPropertySearchCachePatch,
  toPrismaPropertyPatch,
} from "./propertyWriteData.js";
import { purgeOrphanProperties } from "./purgeOrphanProperties.js";
import {
  CompositePropertyMatchDiagnosticsSink,
  LoggerPropertyMatchDiagnosticsSink,
  PrismaPropertyMatchDiagnosticsSink,
} from "./propertyMatchDiagnostics.js";
import type { ListingRepositoryRoles } from "./listingRepository.roles.js";
import { PhotoUrlUsageRepository } from "./photoUrlUsageRepository.js";

const log = createLogger("db");

function toPrismaPropertyEnrichmentPatch(patch: PropertyEnrichmentPatch) {
  const searchPatch = filterPropertySearchCachePatch(patch);
  const {
    description: _description,
    imageUrl: _imageUrl,
    imageUrls: _imageUrls,
    imageLocalHashes: _imageLocalHashes,
    imagePerceptualHashes: _imagePerceptualHashes,
    ...propertyPatch
  } = searchPatch;
  return toPrismaPropertyPatch(propertyPatch);
}

export class ListingRepository implements ListingRepositoryRoles {
  private readonly searchRepo: PropertySearchRepository;
  private readonly statsRepo: PropertyStatsRepository;
  private readonly upsertRepo: PublicationUpsertRepository;
  private readonly projectionUpdater: ProjectionUpdater;
  private readonly photoUrlUsageRepo: PhotoUrlUsageRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.searchRepo = new PropertySearchRepository(prisma);
    this.statsRepo = new PropertyStatsRepository(prisma);
    this.projectionUpdater = new ProjectionUpdater(prisma);
    this.photoUrlUsageRepo = new PhotoUrlUsageRepository(prisma);
    this.upsertRepo = new PublicationUpsertRepository(
      prisma,
      (ids) => this.searchRepo.findByIds(ids),
      new CompositePropertyMatchDiagnosticsSink([
        new LoggerPropertyMatchDiagnosticsSink(),
        new PrismaPropertyMatchDiagnosticsSink(prisma),
      ])
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

  async listRankedPropertyIds(
    filters: ListingSearchFilters
  ): Promise<number[]> {
    return this.searchRepo.listRankedPropertyIds(filters);
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

  async upsertDailySnapshot(): Promise<void> {
    return this.statsRepo.upsertDailySnapshot();
  }

  async getDailySnapshots(since: Date) {
    return this.statsRepo.getDailySnapshots(since);
  }

  async backfillDailySnapshots(days = 90): Promise<number> {
    return this.statsRepo.backfillDailySnapshots(days);
  }

  async getNewPropertiesByDay(since: Date) {
    return this.statsRepo.getNewPropertiesByDay(since);
  }

  async getScrapesByDay(since: Date) {
    return this.statsRepo.getScrapesByDay(since);
  }

  async getDeactivationsByDay(since: Date) {
    return this.statsRepo.getDeactivationsByDay(since);
  }

  async getReactionsByWeek(since: Date) {
    return this.statsRepo.getReactionsByWeek(since);
  }

  async getPriceHistogram(bucketCount?: number) {
    return this.statsRepo.getPriceHistogram(bucketCount);
  }

  async findById(id: number): Promise<PropertyRow | undefined> {
    return this.searchRepo.findById(id);
  }

  async purgeOrphanProperties(): Promise<number> {
    return purgeOrphanProperties(this.prisma);
  }

  async findPropertiesForEnrichmentScan(limit: number): Promise<PropertyRow[]> {
    const rows = await this.prisma.property.findMany({
      where: displayEnrichmentBackfillWhere(),
      take: limit,
      orderBy: { firstSeenAt: "asc" },
      include: propertyInclude,
    });
    return rows.flatMap((row) => {
      const property = tryToPropertyRow(row);
      return property ? [property] : [];
    });
  }

  /**
   * Clears stale "pending image backfill" markers on publications that have no
   * photos to store (enrichedAt set but imageLocalHashes still null).
   */
  async repairDisplayEnrichmentMarkers(): Promise<number> {
    const rows = await this.prisma.listingPublication.findMany({
      where: {
        isActive: true,
        enrichedAt: { not: null },
        imageLocalHashes: { equals: Prisma.DbNull },
      },
      select: { id: true, imageUrls: true },
    });

    const publicationIds = rows
      .filter((row) => {
        if (row.imageUrls === null) return true;
        return Array.isArray(row.imageUrls) && row.imageUrls.length === 0;
      })
      .map((row) => row.id);

    if (publicationIds.length === 0) {
      return 0;
    }

    await this.prisma.listingPublication.updateMany({
      where: { id: { in: publicationIds } },
      data: { imageLocalHashes: {} },
    });

    return publicationIds.length;
  }

  async applyEnrichment(
    id: number,
    patch: PropertyEnrichmentPatch
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    const searchPatch = filterPropertySearchCachePatch(patch);
    if (Object.keys(searchPatch).length === 0) {
      const row = await this.findById(id);
      return row ? { ok: true, value: row } : { ok: false, error: "Not found" };
    }

    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: toPrismaPropertyEnrichmentPatch(searchPatch),
        include: propertyInclude,
      });
      const property = tryToPropertyRow(row);
      return property
        ? { ok: true, value: property }
        : { ok: false, error: "No publications found" };
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
        data: toPrismaPropertyPatch(patch),
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
    if (purpose === "display") {
      const row = await this.findById(id);
      return row ? { ok: true, value: row } : { ok: false, error: "Not found" };
    }

    try {
      const row = await this.prisma.property.update({
        where: { id },
        data: { addressEnrichedAt: new Date() },
        include: propertyInclude,
      });
      const property = tryToPropertyRow(row);
      return property
        ? { ok: true, value: property }
        : { ok: false, error: "No publications found" };
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
    if (purpose === "address") {
      try {
        const publication = await this.prisma.listingPublication.findUnique({
          where: { id: publicationId },
          select: { propertyId: true },
        });
        if (!publication) {
          return { ok: false, error: "Not found" };
        }
        return await this.markEnrichmentAttempted(
          publication.propertyId,
          purpose
        );
      } catch (error) {
        const message = repositoryWriteError(error);
        log.warn(
          `Publication enrichment marker ${String(publicationId)} (${purpose}): ${message}`
        );
        return { ok: false, error: message };
      }
    }

    try {
      const publication = await this.prisma.listingPublication.update({
        where: { id: publicationId },
        data: { enrichedAt: new Date() },
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

  async applyPublicationGallery(
    publicationId: number,
    patch: Pick<
      PropertyEnrichmentPatch,
      "imageUrls" | "imageLocalHashes" | "imagePerceptualHashes"
    >
  ): Promise<RepositoryWriteResult<PropertyRow>> {
    try {
      const publication = await this.prisma.listingPublication.update({
        where: { id: publicationId },
        data: {
          ...toPrismaPropertyPatch(patch),
          enrichedAt: new Date(),
          ...(patch.imageUrls?.[0] ? { imageUrl: patch.imageUrls[0] } : {}),
        },
        select: { propertyId: true },
      });
      return await this.refreshPropertyProjection(publication.propertyId);
    } catch (error) {
      const message = repositoryWriteError(error);
      log.warn(
        `Publication gallery update ${String(publicationId)}: ${message}`
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
      await this.prisma.listingPublication.updateMany({
        where: { propertyId: id },
        data: { address, dpeNumero },
      });
      return await this.refreshPropertyProjection(id);
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

  findOverusedPhotoUrlKeys(minPropertyCount: number): Promise<Set<string>> {
    return this.photoUrlUsageRepo.findOverusedPhotoUrlKeys(minPropertyCount);
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

export function createListingRepository(
  prisma: PrismaClient
): ListingRepository {
  return new ListingRepository(prisma);
}
