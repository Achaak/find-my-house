import type { Listing } from "../types/listing.js";
import {
  findPendingPropertyMatch,
  findPropertyMatchForListing,
  type PropertyMatchCandidate,
} from "./propertyMatchLookup.js";
import {
  PROPERTY_MATCH_THRESHOLD,
  scorePropertyMatch,
  toPropertyMatchInput,
} from "../utils/propertyMatch.js";

export type MatchDiagnostics = {
  threshold: number;
  bestScore: number | null;
  bestCandidateId: number | null;
  bestVeto: string | null;
  nearMisses: {
    candidateId: number;
    score: number;
    veto: string | null;
  }[];
};

export type PropertyMatchPolicy = {
  findPendingMatch<T extends { listing: Listing }>(
    listing: Listing,
    pending: Iterable<T>
  ): T | undefined;
  findCandidateMatch<T extends PropertyMatchCandidate>(
    listing: Listing,
    candidates: T[]
  ): T | undefined;
  collectDiagnostics(
    listing: Listing,
    candidates: PropertyMatchCandidate[]
  ): MatchDiagnostics;
};

export class DefaultPropertyMatchPolicy implements PropertyMatchPolicy {
  findPendingMatch<T extends { listing: Listing }>(
    listing: Listing,
    pending: Iterable<T>
  ): T | undefined {
    return findPendingPropertyMatch(listing, pending);
  }

  findCandidateMatch<T extends PropertyMatchCandidate>(
    listing: Listing,
    candidates: T[]
  ): T | undefined {
    return findPropertyMatchForListing(listing, candidates);
  }

  collectDiagnostics(
    listing: Listing,
    candidates: PropertyMatchCandidate[]
  ): MatchDiagnostics {
    const input = toPropertyMatchInput(listing);
    const scored = candidates.map((candidate) => {
      const result = scorePropertyMatch(input, candidate);
      return {
        candidateId: candidate.id,
        score: result.score,
        veto: result.veto ?? null,
      };
    });
    scored.sort((a, b) => b.score - a.score);
    const best = scored.at(0);
    const nearMisses = scored
      .filter(
        (entry) =>
          entry.score >= PROPERTY_MATCH_THRESHOLD - 0.1 &&
          entry.score < PROPERTY_MATCH_THRESHOLD
      )
      .slice(0, 3);

    return {
      threshold: PROPERTY_MATCH_THRESHOLD,
      bestScore: best?.score ?? null,
      bestCandidateId: best?.candidateId ?? null,
      bestVeto: best?.veto ?? null,
      nearMisses,
    };
  }
}
