import type { Listing } from "../../types/listing.js";
import {
  PROPERTY_MATCH_THRESHOLD,
  toPropertyMatchInput,
} from "../../utils/propertyMatch.js";
import {
  bestPublicationPairScore,
  candidatePublicationInputs,
  type PropertyMatchCandidate,
} from "./lookup.js";

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

/** Pure diagnostics for near-miss logging — callers own the sink adapter. */
export function collectMatchDiagnostics(
  listing: Listing,
  candidates: PropertyMatchCandidate[]
): MatchDiagnostics {
  const input = toPropertyMatchInput(listing);
  const scored = candidates.map((candidate) => {
    const publicationInputs = candidatePublicationInputs(candidate, {
      fallbackToProperty: true,
    });
    const best = bestPublicationPairScore([input], publicationInputs);
    return {
      candidateId: candidate.id,
      score: best.score,
      veto: best.veto,
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
