import type { Listing } from "../types/listing.js";
import { parseBieniciAgency } from "../utils/bienici/agency.js";
import {
  propertiesMatchFuzzy,
  toPropertyMatchInput,
  type PropertyMatchInput,
} from "../utils/propertyMatch.js";

type PublicationAgency = {
  source: string;
  agencySlug: string | null;
  agencyRef: string | null;
};

export type PropertyMatchCandidate = PropertyMatchInput & {
  id: number;
  publications?: PublicationAgency[];
};

export function findFuzzyPropertyMatch<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  const input = toPropertyMatchInput(listing);

  return candidates.find((candidate) => propertiesMatchFuzzy(input, candidate));
}

export function findAgencyPropertyMatch<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  if (listing.source !== "bienici") return undefined;

  const agency = parseBieniciAgency(listing.externalId);
  if (!agency) return undefined;

  const input = toPropertyMatchInput(listing);

  return candidates.find((candidate) =>
    candidate.publications?.some(
      (publication) =>
        publication.source === "bienici" &&
        publication.agencySlug === agency.agencySlug &&
        propertiesMatchFuzzy(input, candidate)
    )
  );
}

export function findPropertyMatchForListing<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  return (
    findAgencyPropertyMatch(listing, candidates) ??
    findFuzzyPropertyMatch(listing, candidates)
  );
}

export function findPendingPropertyMatch<T extends { listing: Listing }>(
  listing: Listing,
  pending: Iterable<T>
): T | undefined {
  const input = toPropertyMatchInput(listing);

  for (const entry of pending) {
    if (propertiesMatchFuzzy(input, toPropertyMatchInput(entry.listing))) {
      return entry;
    }
  }

  return undefined;
}
