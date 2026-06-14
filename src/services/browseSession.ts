import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import { pickBrowseListing } from "../utils/compatibility/pickBrowseListing.js";
import { resolveListingCompatibilityPreferences } from "../services/compatibilityService.js";

export type BrowseSession = {
  filters: ListingSearchFilters;
  shownCount: number;
};

const sessions = new Map<string, BrowseSession>();

export function startBrowseSession(
  userId: string,
  filters: ListingSearchFilters
): BrowseSession {
  const session = { filters, shownCount: 0 };
  sessions.set(userId, session);
  return session;
}

export function clearBrowseSession(userId: string): void {
  sessions.delete(userId);
}

export function getBrowseSession(userId: string): BrowseSession | undefined {
  return sessions.get(userId);
}

async function loadBrowseCandidates(
  repository: ListingRepository,
  userId: string,
  filters: ListingSearchFilters
): Promise<PropertyRow[]> {
  const { items } = await repository.search({
    ...filters,
    excludeReactedByUser: userId,
    limit: 100,
    sort: "date_desc",
  });
  return items;
}

export async function pickNextBrowseListing(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession,
  preferences?: CompatibilityPreferences | null
): Promise<{
  property: PropertyRow;
  isExplore: boolean;
} | null> {
  const resolvedPreferences =
    preferences ??
    (await resolveListingCompatibilityPreferences(reactionRepository, userId));

  const candidates = await loadBrowseCandidates(
    repository,
    userId,
    session.filters
  );
  const pick = pickBrowseListing(
    candidates,
    resolvedPreferences,
    session.shownCount
  );

  if (!pick) return null;

  session.shownCount += 1;
  return pick;
}

export type BrowseState = {
  property: PropertyRow | null;
  shownCount: number;
  isExplore: boolean;
  hasPreferences: boolean;
  finished: boolean;
};

export async function getBrowseState(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession
): Promise<BrowseState> {
  const preferences = await resolveListingCompatibilityPreferences(
    reactionRepository,
    userId
  );
  const pick = await pickNextBrowseListing(
    repository,
    reactionRepository,
    userId,
    session,
    preferences
  );

  if (!pick) {
    clearBrowseSession(userId);
    return {
      property: null,
      shownCount: session.shownCount,
      isExplore: false,
      hasPreferences: preferences !== null,
      finished: true,
    };
  }

  return {
    property: pick.property,
    shownCount: session.shownCount,
    isExplore: pick.isExplore,
    hasPreferences: preferences !== null,
    finished: false,
  };
}
