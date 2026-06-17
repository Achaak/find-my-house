import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityModel } from "../types/compatibility.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import { pickBrowseListing } from "../utils/compatibility/pickBrowseListing.js";
import { resolveGeoFilter } from "../utils/geo/geoFilter.js";

export type BrowseSession = {
  filters: ListingSearchFilters;
  shownCount: number;
  currentPropertyId: number | null;
  currentIsExplore: boolean;
  candidatePool: PropertyRow[];
  seenPropertyIds: number[];
  reactedPropertyIds: Set<number> | null;
  geoRankedIds: number[] | null;
  geoRankedCursor: number;
};

export const BROWSE_POOL_TARGET = 100;
export const BROWSE_POOL_REFILL_THRESHOLD = 20;
const BROWSE_GEO_ID_BATCH = 50;

function usesGeoBrowseFilter(filters: ListingSearchFilters): boolean {
  return resolveGeoFilter(filters, true).mode !== "city";
}

function browseSearchFilters(session: BrowseSession): ListingSearchFilters {
  return {
    ...session.filters,
    excludeReacted: true,
    sort: "date_desc",
    includeTotal: false,
  };
}

function reservedPropertyIds(session: BrowseSession): Set<number> {
  const reserved = new Set(session.seenPropertyIds);
  for (const property of session.candidatePool) {
    reserved.add(property.id);
  }
  if (session.reactedPropertyIds) {
    for (const propertyId of session.reactedPropertyIds) {
      reserved.add(propertyId);
    }
  }
  return reserved;
}

function pruneBrowsePool(session: BrowseSession): void {
  const remove = new Set(session.seenPropertyIds);
  if (session.reactedPropertyIds) {
    for (const propertyId of session.reactedPropertyIds) {
      remove.add(propertyId);
    }
  }
  session.candidatePool = session.candidatePool.filter(
    (property) => !remove.has(property.id)
  );
}

async function ensureReactedPropertyIds(
  session: BrowseSession,
  reactionRepository: ReactionRepository
): Promise<void> {
  if (session.reactedPropertyIds !== null) return;
  session.reactedPropertyIds = await reactionRepository.getReactedPropertyIds();
}

async function refillBrowsePoolFromGeo(
  session: BrowseSession,
  repository: ListingRepository
): Promise<void> {
  if (!session.geoRankedIds) {
    session.geoRankedIds = await repository.listRankedPropertyIds(
      browseSearchFilters(session)
    );
    session.geoRankedCursor = 0;
  }

  const excluded = reservedPropertyIds(session);
  const nextIds: number[] = [];

  while (
    nextIds.length < BROWSE_GEO_ID_BATCH &&
    session.geoRankedCursor < session.geoRankedIds.length &&
    session.candidatePool.length + nextIds.length < BROWSE_POOL_TARGET
  ) {
    const id = session.geoRankedIds[session.geoRankedCursor];
    session.geoRankedCursor += 1;
    if (excluded.has(id)) continue;
    nextIds.push(id);
  }

  if (nextIds.length === 0) return;

  const properties = await repository.findByIds(nextIds);
  const byId = new Map(properties.map((property) => [property.id, property]));
  for (const id of nextIds) {
    const property = byId.get(id);
    if (property) {
      session.candidatePool.push(property);
    }
  }
}

async function refillBrowsePoolFromSearch(
  session: BrowseSession,
  repository: ListingRepository
): Promise<void> {
  const excluded = reservedPropertyIds(session);
  const { items } = await repository.search({
    ...browseSearchFilters(session),
    limit: BROWSE_POOL_TARGET,
  });

  for (const property of items) {
    if (excluded.has(property.id)) continue;
    session.candidatePool.push(property);
    if (session.candidatePool.length >= BROWSE_POOL_TARGET) break;
  }
}

export async function ensureBrowsePool(
  session: BrowseSession,
  repository: ListingRepository,
  reactionRepository: ReactionRepository
): Promise<void> {
  await ensureReactedPropertyIds(session, reactionRepository);
  pruneBrowsePool(session);

  const hasUnseenCandidates = session.candidatePool.some(
    (property) => !session.seenPropertyIds.includes(property.id)
  );
  if (
    hasUnseenCandidates &&
    session.candidatePool.length >= BROWSE_POOL_REFILL_THRESHOLD
  ) {
    return;
  }
  if (hasUnseenCandidates && session.candidatePool.length > 0) {
    return;
  }

  while (session.candidatePool.length < BROWSE_POOL_REFILL_THRESHOLD) {
    const before = session.candidatePool.length;

    if (usesGeoBrowseFilter(session.filters)) {
      await refillBrowsePoolFromGeo(session, repository);
    } else {
      await refillBrowsePoolFromSearch(session, repository);
      pruneBrowsePool(session);
      break;
    }

    pruneBrowsePool(session);
    if (session.candidatePool.length === before) break;
  }
}

export function noteBrowseReaction(
  session: BrowseSession,
  propertyId: number
): void {
  session.reactedPropertyIds ??= new Set();
  session.reactedPropertyIds.add(propertyId);
  session.candidatePool = session.candidatePool.filter(
    (property) => property.id !== propertyId
  );
}

export async function pickNextFromBrowsePool(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  session: BrowseSession,
  model: CompatibilityModel | null
): Promise<{
  property: PropertyRow;
  isExplore: boolean;
} | null> {
  await ensureBrowsePool(session, repository, reactionRepository);

  const candidates = session.candidatePool.filter(
    (property) => !session.seenPropertyIds.includes(property.id)
  );

  const pick = pickBrowseListing(candidates, model, session.shownCount);

  if (!pick) return null;

  session.candidatePool = session.candidatePool.filter(
    (property) => property.id !== pick.property.id
  );
  session.seenPropertyIds.push(pick.property.id);
  session.shownCount += 1;

  return pick;
}
