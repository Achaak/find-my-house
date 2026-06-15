import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { EnrichmentQueue } from "../services/enrichmentQueue.js";
import type { ScraperService } from "../services/scraperService.js";
import type { ScrapeFilters } from "../types/listing.js";

export type ApiContext = {
  repository: ListingRepository;
  reactionRepository: ReactionRepository;
  scraperService: ScraperService;
  enrichmentQueue: EnrichmentQueue;
  scrapeDefaults: ScrapeFilters;
  notifyScrapeResults: (
    result: Awaited<ReturnType<ScraperService["run"]>>
  ) => Promise<unknown>;
};

export type {
  ApiUser,
  BrowseState,
  DpeCandidate,
  EnrichmentStatus,
  ListingDetailResponse,
  ListingSearchFilters,
  ListingSearchSort,
  ListingSource,
  Property,
  PropertyAddressSearchResponse,
  PropertyReactionState,
  PropertyPublication,
  ReconcileResult,
} from "@find-my-house/api-types";
