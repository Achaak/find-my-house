import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import {
  getListingCompatibilityCard,
  resolveCompatibilityModel,
} from "./compatibilityService.js";
import { getEnrichmentStatus } from "./enrichmentService.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";
import { getCompatibilityScore } from "../utils/compatibility/score.js";
import { sortByCompatibility } from "../utils/compatibility/score.js";

export type EnrichmentBackfillOptions = {
  /** Minimum compatibility score (0 = all pending listings). */
  minScore?: number;
  limit?: number;
  searchLimit?: number;
};

const DEFAULT_MIN_SCORE = 0;
const DEFAULT_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 1000;

/**
 * Queues display enrichment for pending listings, prioritising compatibility
 * when preferences are available. Intended to gradually enrich the full catalog.
 */
export async function scheduleEnrichmentBackfill(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  queue: EnrichmentQueue,
  options: EnrichmentBackfillOptions = {}
): Promise<number> {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const searchLimit = options.searchLimit ?? DEFAULT_SEARCH_LIMIT;
  const model = await resolveCompatibilityModel(reactionRepository);

  const scanned = await repository.findPropertiesForEnrichmentScan(searchLimit);
  const pending = scanned.filter(
    (property) => getEnrichmentStatus(property, "display") === "pending"
  );

  const ranked = model ? sortByCompatibility(pending, model) : pending;

  const candidates = ranked
    .filter((property) => {
      if (minScore <= 0) return true;
      if (!model) return true;
      const score = getCompatibilityScore(property, model);
      return score !== undefined && score >= minScore;
    })
    .slice(0, limit);

  for (const property of candidates) {
    queue.schedule(property.id, "display", "low");
  }

  return candidates.length;
}

/** @deprecated Use scheduleEnrichmentBackfill */
export const scheduleHighCompatibilityBackfill = scheduleEnrichmentBackfill;

/** @deprecated Use EnrichmentBackfillOptions */
export type HighCompatibilityBackfillOptions = EnrichmentBackfillOptions;

export function compatibilityCardForProperty(
  ...args: Parameters<typeof getListingCompatibilityCard>
) {
  return getListingCompatibilityCard(...args);
}
