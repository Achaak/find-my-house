import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import { resolveCompatibilityModel } from "./compatibilityService.js";
import { propertyNeedsDisplayBackfill } from "./enrichment/criteria.js";
import type { EnrichmentQueue } from "./enrichmentQueue.js";
import { getCompatibilityScore } from "../utils/compatibility/score.js";
import { sortByCompatibility } from "../utils/compatibility/score.js";
import { createLogger } from "../utils/logger.js";
import type { PropertyRow } from "../types/listing.js";

const log = createLogger("enrichment-backfill");

export type EnrichmentBackfillOptions = {
  /** Minimum compatibility score (0 = all pending listings). */
  minScore?: number;
  limit?: number;
  searchLimit?: number;
};

const DEFAULT_MIN_SCORE = 0;
const DEFAULT_LIMIT = 10;
const DEFAULT_SEARCH_LIMIT = 1000;

function selectCandidates(
  pending: PropertyRow[],
  model: Awaited<ReturnType<typeof resolveCompatibilityModel>>,
  minScore: number,
  limit: number
): PropertyRow[] {
  const ranked = model ? sortByCompatibility(pending, model) : pending;

  const filterByScore = (scoreThreshold: number) =>
    ranked
      .filter((property) => {
        if (scoreThreshold <= 0) return true;
        if (!model) return true;
        const score = getCompatibilityScore(property, model);
        return score !== undefined && score >= scoreThreshold;
      })
      .slice(0, limit);

  const candidates = filterByScore(minScore);
  if (candidates.length > 0 || minScore <= 0 || pending.length === 0) {
    return candidates;
  }

  log.warn(
    `No listings met min compat score ${String(minScore)} — falling back to all pending`
  );
  return filterByScore(0);
}

/**
 * Queues display enrichment for pending Properties (first-time or incomplete
 * local image hashes). Does not enqueue sticky HTML-portal refresh.
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
  const pending = scanned.filter(propertyNeedsDisplayBackfill);
  const candidates = selectCandidates(pending, model, minScore, limit);

  for (const property of candidates) {
    queue.schedule(property.id, "display", "low");
  }

  return candidates.length;
}
