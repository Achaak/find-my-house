/**
 * Property matching — shared rules for scrape-time linking and reconcile.
 * @see CONTEXT.md "Property matching"
 */

export {
  toPropertyMatchCandidate,
  findAgencyPropertyMatch,
  findFuzzyPropertyMatch,
  findPropertyMatchForListing,
  findPendingPropertyMatch,
  anyPublicationPairMatches,
  bestPublicationPairScore,
  candidatePublicationInputs,
  type PropertyMatchCandidate,
  type PublicationMatchCandidate,
} from "./lookup.js";

export {
  groupByStrictPropertyKey,
  groupByFuzzyPropertyMatch,
  propertyRecordToPublicationInputs,
} from "./group.js";

export {
  collectMatchDiagnostics,
  type MatchDiagnostics,
} from "./diagnostics.js";
