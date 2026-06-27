import type { ListingRepository } from "../db/listingRepository.js";
import type { ReactionRepository } from "../db/reactionRepository.js";
import type { CompatibilityModel } from "../types/compatibility.js";
import type { ListingSearchFilters, PropertyRow } from "../types/listing.js";
import { resolveCompatibilityModel } from "../services/compatibilityService.js";
import {
  noteBrowseReaction,
  pickNextFromBrowsePool,
  type BrowseSession,
  type PendingDislikeUndo,
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
    pendingDislikeUndo: null,
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
  model?: CompatibilityModel | null
): Promise<{
  property: PropertyRow;
  isExplore: boolean;
} | null> {
  const resolvedModel =
    model ?? (await resolveCompatibilityModel(reactionRepository));

  return pickNextFromBrowsePool(
    repository,
    reactionRepository,
    session,
    resolvedModel
  );
}

export type BrowseState = {
  property: PropertyRow | null;
  shownCount: number;
  isExplore: boolean;
  hasPreferences: boolean;
  finished: boolean;
  model: CompatibilityModel | null;
};

function buildBrowseState(
  userId: string,
  session: BrowseSession,
  model: CompatibilityModel | null,
  property: PropertyRow | null,
  isExplore: boolean
): BrowseState {
  if (!property) {
    clearBrowseSession(userId);
    return {
      property: null,
      shownCount: session.shownCount,
      isExplore: false,
      hasPreferences: model !== null,
      finished: true,
      model,
    };
  }

  return {
    property,
    shownCount: session.shownCount,
    isExplore,
    hasPreferences: model !== null,
    finished: false,
    model,
  };
}

/** Return the current listing without advancing the session cursor. */
export async function getBrowseState(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession
): Promise<BrowseState> {
  const model = await resolveCompatibilityModel(reactionRepository);

  if (session.currentPropertyId !== null) {
    const property = await repository.findById(session.currentPropertyId);
    if (property) {
      return buildBrowseState(
        userId,
        session,
        model,
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
    model
  );
}

/** Pick the next listing and store it as the session cursor. */
export async function advanceBrowseSession(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession,
  model?: CompatibilityModel | null
): Promise<BrowseState> {
  const resolvedModel =
    model ?? (await resolveCompatibilityModel(reactionRepository));

  session.currentPropertyId = null;

  const pick = await pickNextBrowseListing(
    repository,
    reactionRepository,
    userId,
    session,
    resolvedModel
  );

  if (!pick) {
    return buildBrowseState(userId, session, resolvedModel, null, false);
  }

  session.currentPropertyId = pick.property.id;
  session.currentIsExplore = pick.isExplore;

  return buildBrowseState(
    userId,
    session,
    resolvedModel,
    pick.property,
    pick.isExplore
  );
}

export function setPendingDislikeUndo(
  session: BrowseSession,
  undo: PendingDislikeUndo
): void {
  session.pendingDislikeUndo = undo;
}

export function clearPendingDislikeUndo(session: BrowseSession): void {
  session.pendingDislikeUndo = null;
}

/** Rewind browse session after undoing a dislike within the grace window. */
export async function rewindBrowseDislike(
  repository: ListingRepository,
  reactionRepository: ReactionRepository,
  userId: string,
  session: BrowseSession,
  propertyId: number,
  graceMs: number
): Promise<
  | { ok: true; state: BrowseState }
  | {
      ok: false;
      reason: "no_pending" | "grace_expired" | "not_found" | "not_dislike";
    }
> {
  const pending = session.pendingDislikeUndo;
  if (pending?.dislikedPropertyId !== propertyId) {
    return { ok: false, reason: "no_pending" };
  }

  const status = await reactionRepository.removeDislikeWithinGrace(
    propertyId,
    graceMs
  );
  if (status === "grace_expired") {
    return { ok: false, reason: "grace_expired" };
  }
  if (status === "not_found") {
    return { ok: false, reason: "not_found" };
  }
  if (status === "not_dislike") {
    return { ok: false, reason: "not_dislike" };
  }

  if (pending.advancedToPropertyId !== null) {
    const lastSeen = session.seenPropertyIds.at(-1);
    if (lastSeen === pending.advancedToPropertyId) {
      session.seenPropertyIds.pop();
      session.shownCount = Math.max(0, session.shownCount - 1);
    }
    const advancedProperty = pending.advancedProperty;
    if (
      advancedProperty &&
      !session.candidatePool.some(
        (property) => property.id === advancedProperty.id
      )
    ) {
      session.candidatePool.unshift(advancedProperty);
    }
  }

  session.reactedPropertyIds?.delete(propertyId);
  session.pendingDislikeUndo = null;

  const property = await repository.findById(propertyId);
  if (!property) {
    session.currentPropertyId = null;
    const model = await resolveCompatibilityModel(reactionRepository);
    return {
      ok: true,
      state: buildBrowseState(userId, session, model, null, false),
    };
  }

  session.currentPropertyId = propertyId;
  session.currentIsExplore = pending.dislikedIsExplore;

  const model = await resolveCompatibilityModel(reactionRepository);
  return {
    ok: true,
    state: buildBrowseState(
      userId,
      session,
      model,
      property,
      session.currentIsExplore
    ),
  };
}
