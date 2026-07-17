import type { Listing } from "../../types/listing.js";
import { parseBieniciAgency } from "../../utils/bienici/agency.js";
import {
  propertiesMatchFuzzy,
  scorePropertyMatch,
  toPropertyMatchInput,
  type PropertyMatchInput,
} from "../../utils/propertyMatch.js";

type PublicationAgency = {
  source?: string;
  agencySlug?: string | null;
  agencyRef?: string | null;
};

export type PublicationMatchCandidate = PropertyMatchInput & PublicationAgency;

export type PropertyMatchCandidate = PropertyMatchInput & {
  id: number;
  publications?: PublicationMatchCandidate[];
};

type PropertyWithPublicationMatchFields = {
  id: number;
  postalCode: string | null;
  price: number;
  surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  landSurface: number | null;
  isNewProperty: boolean | null;
  publications: {
    source: string;
    postalCode: string | null;
    price: number;
    surface: number | null;
    rooms: number | null;
    bedrooms: number | null;
    landSurface: number | null;
    propertyType: string | null;
    isNewProperty: boolean | null;
    agencySlug: string | null;
    agencyRef: string | null;
  }[];
};

export function toPropertyMatchCandidate(
  property: PropertyWithPublicationMatchFields
): PropertyMatchCandidate {
  const propertyType =
    property.publications.find((publication) => publication.propertyType)
      ?.propertyType ?? null;
  return {
    id: property.id,
    postalCode: property.postalCode,
    price: property.price,
    surface: property.surface,
    rooms: property.rooms,
    bedrooms: property.bedrooms,
    landSurface: property.landSurface,
    isNewProperty: property.isNewProperty,
    propertyType,
    publications: property.publications.map((publication) => ({
      postalCode: publication.postalCode,
      price: publication.price,
      surface: publication.surface,
      rooms: publication.rooms,
      bedrooms: publication.bedrooms,
      landSurface: publication.landSurface,
      propertyType: publication.propertyType,
      isNewProperty: publication.isNewProperty,
      source: publication.source,
      agencySlug: publication.agencySlug,
      agencyRef: publication.agencyRef,
    })),
  };
}

function pendingListings(pending: {
  listing: Listing;
  extraPublications?: { listing: Listing }[];
}): Listing[] {
  return [
    pending.listing,
    ...(pending.extraPublications?.map((entry) => entry.listing) ?? []),
  ];
}

function resolvePublicationInput(
  publication: Partial<PropertyMatchInput> & PublicationAgency,
  fallback: PropertyMatchInput
): PropertyMatchInput {
  return toPropertyMatchInput({
    postalCode: publication.postalCode ?? fallback.postalCode,
    price: publication.price ?? fallback.price,
    surface: publication.surface ?? fallback.surface,
    rooms: publication.rooms ?? fallback.rooms,
    bedrooms: publication.bedrooms ?? fallback.bedrooms,
    landSurface: publication.landSurface ?? fallback.landSurface,
    propertyType: publication.propertyType ?? fallback.propertyType,
    isNewProperty: publication.isNewProperty ?? fallback.isNewProperty,
  });
}

export function candidatePublicationInputs(
  candidate: PropertyMatchCandidate,
  options: { fallbackToProperty?: boolean } = { fallbackToProperty: true }
): PropertyMatchInput[] {
  const fallback = toPropertyMatchInput(candidate);
  if (!candidate.publications?.length) {
    return [fallback];
  }

  if (options.fallbackToProperty === false) {
    return candidate.publications.map((publication) =>
      toPropertyMatchInput({
        postalCode: publication.postalCode ?? fallback.postalCode,
        price: publication.price,
        surface: publication.surface,
        rooms: publication.rooms,
        bedrooms: publication.bedrooms,
        landSurface: publication.landSurface,
        propertyType: publication.propertyType,
        isNewProperty: publication.isNewProperty,
      })
    );
  }

  return candidate.publications.map((publication) =>
    resolvePublicationInput(publication, fallback)
  );
}

function listingMatchesInputs(
  listing: Listing,
  inputs: PropertyMatchInput[]
): boolean {
  const listingInput = toPropertyMatchInput(listing);
  return inputs.some((input) => propertiesMatchFuzzy(listingInput, input));
}

export function findFuzzyPropertyMatch<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  return candidates.find((candidate) =>
    listingMatchesInputs(
      listing,
      candidatePublicationInputs(candidate, { fallbackToProperty: true })
    )
  );
}

export function findAgencyPropertyMatch<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  if (listing.source !== "bienici") return undefined;

  const agency = parseBieniciAgency(listing.externalId);
  if (!agency) return undefined;

  const listingInput = toPropertyMatchInput(listing);

  return candidates.find((candidate) => {
    const fallbackInput = toPropertyMatchInput(candidate);
    return candidate.publications?.some((publication) => {
      if (publication.source !== "bienici") return false;
      if (publication.agencySlug !== agency.agencySlug) return false;
      const publicationInput = resolvePublicationInput(
        publication,
        fallbackInput
      );
      return propertiesMatchFuzzy(listingInput, publicationInput);
    });
  });
}

/** Ingest + reconcile: agency first, then fuzzy. */
export function findPropertyMatchForListing<T extends PropertyMatchCandidate>(
  listing: Listing,
  candidates: T[]
): T | undefined {
  return (
    findAgencyPropertyMatch(listing, candidates) ??
    findFuzzyPropertyMatch(listing, candidates)
  );
}

function listingsMatchViaAgency(left: Listing, right: Listing): boolean {
  if (left.source !== "bienici" || right.source !== "bienici") return false;
  const leftAgency = parseBieniciAgency(left.externalId);
  const rightAgency = parseBieniciAgency(right.externalId);
  if (!leftAgency || !rightAgency) return false;
  if (leftAgency.agencySlug !== rightAgency.agencySlug) return false;
  return propertiesMatchFuzzy(
    toPropertyMatchInput(left),
    toPropertyMatchInput(right)
  );
}

export function findPendingPropertyMatch<T extends { listing: Listing }>(
  listing: Listing,
  pending: Iterable<T>
): T | undefined {
  const listingInput = toPropertyMatchInput(listing);

  for (const entry of pending) {
    const peers = pendingListings(entry);
    if (peers.some((peer) => listingsMatchViaAgency(listing, peer))) {
      return entry;
    }
    const inputs = peers.map((pendingListing) =>
      toPropertyMatchInput(pendingListing)
    );
    if (inputs.some((input) => propertiesMatchFuzzy(listingInput, input))) {
      return entry;
    }
  }

  return undefined;
}

/**
 * Shared pair predicate for ingest diagnostics and reconcile grouping.
 * Fuzzy on field bags, or Bienici pubs sharing agencySlug + fuzzy fields.
 */
export function anyPublicationPairMatches(
  leftInputs: (PropertyMatchInput & PublicationAgency)[],
  rightInputs: (PropertyMatchInput & PublicationAgency)[]
): boolean {
  for (const left of leftInputs) {
    for (const right of rightInputs) {
      if (propertiesMatchFuzzy(left, right)) {
        return true;
      }
      if (
        left.source === "bienici" &&
        right.source === "bienici" &&
        left.agencySlug &&
        left.agencySlug === right.agencySlug &&
        propertiesMatchFuzzy(left, right)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function bestPublicationPairScore(
  leftInputs: PropertyMatchInput[],
  rightInputs: PropertyMatchInput[]
): { score: number; veto: string | null } {
  let bestScore = 0;
  let bestVeto: string | null = null;

  for (const left of leftInputs) {
    for (const right of rightInputs) {
      const result = scorePropertyMatch(left, right);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestVeto = result.veto ?? null;
      }
    }
  }

  return { score: bestScore, veto: bestVeto };
}
