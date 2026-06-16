import type {
  DefaultPropertyMatchPolicy,
  PropertyMatchPolicy,
} from "./propertyMatchPolicy.js";
import type { Listing } from "../types/listing.js";
import type { PropertyMatchDiagnosticsSink } from "./propertyMatchDiagnostics.js";

type CandidateLike = {
  id: number;
  firstPrice: number;
  postalCode: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  landSurface: number | null;
  propertyType: string | null;
  isNewProperty: boolean | null;
};

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

  findCandidateMatch(listing: Listing, candidates: CandidateLike[]) {
    return this.propertyMatchPolicy.findCandidateMatch(listing, candidates);
  }

  async recordCandidateMiss(listing: Listing, candidates: CandidateLike[]) {
    if (candidates.length === 0) return;
    const diagnostics = this.propertyMatchPolicy.collectDiagnostics(
      listing,
      candidates
    );
    await this.diagnosticsSink.recordCandidateMiss(listing, diagnostics);
  }
}

export type PropertyDedupPolicy = DefaultPropertyMatchPolicy;
