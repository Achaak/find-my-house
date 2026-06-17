import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityPreferences } from "../types/compatibility.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import { resolveListingCompatibilityPreferences } from "../services/compatibilityService.js";
import {
  noteBrowseReaction,
  pickNextFromBrowsePool,
  type BrowseSession,
} from "./browseCandidates.js";

export type { BrowseSession };

const sessions = new Map<string, BrowseSession>();

function createBrowseSessionState(
  filters: ListingSearchFilters
): BrowseSession {
  return {
    filters,
    shownCount: 0,
    currentPropertyId: null,
    currentIsExplore: false,
    candidatePool: [],
    seenPropertyIds: [],
    reactedPropertyIds: null,
    geoRankedIds: null,
    geoRankedCursor: 0,
  };
}

export function startBrowseSession(
  userId: string,
  filters: ListingSearchFilters
): BrowseSession {
  const session = createBrowseSessionState(filters);
  sessions.set(userId, session);
  return session;
}

export function clearBrowseSession(userId: string): void {
  sessions.delete(userId);
}

export function getBrowseSession(userId: string): BrowseSession | undefined {
  return sessions.get(userId);
}

export { noteBrowseReaction };

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
    (await resolveListingCompatibilityPreferences(reactionRepository));

  return pickNextFromBrowsePool(
    repository,
    reactionRepository,
    session,
    resolvedPreferences
  );
}

export type BrowseState = {
  property: PropertyRow | null;
  shownCount: number;
  isExplore: boolean;
  hasPreferences: boolean;
  finished: boolean;
  preferences: CompatibilityPreferences | null;
};

function buildBrowseState(
  userId: string,
  session: BrowseSession,
  preferences: CompatibilityPreferences | null,
  property: PropertyRow | null,
  isExplore: boolean
): BrowseState {
  if (!property) {
    clearBrowseSession(userId);
    return {
      property: null,
      shownCount: session.shownCount,
      isExplore: false,
      hasPreferences: preferences !== null,
      finished: true,
      preferences,
    };
  }

  return {
    property,
    shownCount: session.shownCount,
    isExplore,
    hasPreferences: preferences !== null,
    finished: false,
    preferences,
  };
}

/** Return the current listing without advancing the session cursor. */
export async function getBrowseState(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession
): Promise<BrowseState> {
  const preferences =
    await resolveListingCompatibilityPreferences(reactionRepository);

  if (session.currentPropertyId !== null) {
    const property = await repository.findById(session.currentPropertyId);
    if (property) {
      return buildBrowseState(
        userId,
        session,
        preferences,
        property,
        session.currentIsExplore
      );
    }
    session.currentPropertyId = null;
  }

  return advanceBrowseSession(
    repository,
    reactionRepository,
    userId,
    session,
    preferences
  );
}

/** Pick the next listing and store it as the session cursor. */
export async function advanceBrowseSession(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession,
  preferences?: CompatibilityPreferences | null
): Promise<BrowseState> {
  const resolvedPreferences =
    preferences ??
    (await resolveListingCompatibilityPreferences(reactionRepository));

  session.currentPropertyId = null;

  const pick = await pickNextBrowseListing(
    repository,
    reactionRepository,
    userId,
    session,
    resolvedPreferences
  );

  if (!pick) {
    return buildBrowseState(userId, session, resolvedPreferences, null, false);
  }

  session.currentPropertyId = pick.property.id;
  session.currentIsExplore = pick.isExplore;

  return buildBrowseState(
    userId,
    session,
    resolvedPreferences,
    pick.property,
    pick.isExplore
  );
}
