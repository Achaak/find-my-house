import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import type {
  ActivityStats,
  CityCount,
  PriceStats,
  SourcePublicationCounts,
} from "../types/stats.js";
import type { PropertyEnrichmentPatch } from "../types/enrichment.js";
import type { RepositoryWriteResult } from "../types/db.js";
import type { ReconcileResult } from "@find-my-house/api-types";
import type { PublicationUpsertRepository } from "./publicationUpsertRepository.js";

export type ListingWriteRepository = Pick<
  PublicationUpsertRepository,
  "upsert" | "upsertMany" | "deactivateMissingPublications"
> & {
  applyEnrichment(
    id: number,
    patch: PropertyEnrichmentPatch
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  applyPublicationEnrichment(
    publicationId: number,
    patch: PropertyEnrichmentPatch
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  markEnrichmentAttempted(
    id: number,
    purpose: "display" | "address"
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  markPublicationEnrichmentAttempted(
    publicationId: number,
    purpose: "display" | "address"
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  applyPublicationGallery(
    publicationId: number,
    patch: Pick<
      PropertyEnrichmentPatch,
      "imageUrls" | "imageLocalHashes" | "imagePerceptualHashes"
    >
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  updateAddress(
    id: number,
    address: string,
    dpeNumero: string | null
  ): Promise<RepositoryWriteResult<PropertyRow>>;
  refreshPropertyProjection(
    propertyId: number
  ): Promise<RepositoryWriteResult<PropertyRow>>;
};

export type ListingSearchRepository = {
  findRecent(limit?: number): Promise<PropertyRow[]>;
  search(
    filters: ListingSearchFilters
  ): Promise<{ items: PropertyRow[]; total: number }>;
  listRankedPropertyIds(filters: ListingSearchFilters): Promise<number[]>;
  findAddedSince(since: Date, limit?: number): Promise<PropertyRow[]>;
  findById(id: number): Promise<PropertyRow | undefined>;
  findByIds(ids: number[]): Promise<PropertyRow[]>;
  findPropertiesForEnrichmentScan(limit: number): Promise<PropertyRow[]>;
  findPropertiesForImageBackfillScan(limit: number): Promise<PropertyRow[]>;
};

export type ListingStatsRepository = {
  count(): Promise<number>;
  countPublications(): Promise<number>;
  countActiveProperties(): Promise<number>;
  countPendingDisplayEnrichment(): Promise<number>;
  countInactivePublications(): Promise<number>;
  getPublicationCountsBySource(): Promise<SourcePublicationCounts>;
  countPriceDrops(): Promise<number>;
  getPriceStats(): Promise<PriceStats | null>;
  findPriceDrops(limit?: number): Promise<PropertyRow[]>;
  getTopCities(limit?: number): Promise<CityCount[]>;
  getActivityStats(): Promise<ActivityStats>;
};

export type ListingReconcileRepository = {
  reconcileDuplicates(postalCodes?: string[]): Promise<ReconcileResult>;
};

export type ListingPhotoUrlRepository = {
  findOverusedPhotoUrlKeys(minPropertyCount: number): Promise<Set<string>>;
};

export type ListingRepositoryRoles = ListingWriteRepository &
  ListingSearchRepository &
  ListingStatsRepository &
  ListingReconcileRepository &
  ListingPhotoUrlRepository;
