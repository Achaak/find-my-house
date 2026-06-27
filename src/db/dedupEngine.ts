import type {
  DefaultPropertyMatchPolicy,
  PropertyMatchPolicy,
} from "./propertyMatchPolicy.js";
import type { PropertyMatchCandidate } from "./propertyMatchLookup.js";
import type { Listing } from "../types/listing.js";
import type { PropertyMatchDiagnosticsSink } from "./propertyMatchDiagnostics.js";

export class DedupEngine {
  constructor(
    private readonly propertyMatchPolicy: PropertyMatchPolicy,
    private readonly diagnosticsSink: PropertyMatchDiagnosticsSink
  ) {}

  findPendingMatch<TPending extends { listing: Listing }>(
    listing: Listing,
    pending: Iterable<TPending>
  ) {
    return this.propertyMatchPolicy.findPendingMatch(listing, pending);
  }

  findCandidateMatch(listing: Listing, candidates: PropertyMatchCandidate[]) {
    return this.propertyMatchPolicy.findCandidateMatch(listing, candidates);
  }

  async recordCandidateMiss(
    listing: Listing,
    candidates: PropertyMatchCandidate[]
  ) {
    if (candidates.length === 0) return;
    const diagnostics = this.propertyMatchPolicy.collectDiagnostics(
      listing,
      candidates
    );
    await this.diagnosticsSink.recordCandidateMiss(listing, diagnostics);
  }
}

export type PropertyDedupPolicy = DefaultPropertyMatchPolicy;
