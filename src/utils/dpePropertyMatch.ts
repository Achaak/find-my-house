import type { PropertyRow } from "../types/listing.js";
import type { DpeSearchResult } from "./ademeDpeApi.js";
import { haversineDistanceKm } from "./geo.js";

export type RankedDpeSearchResult = DpeSearchResult & {
  matchScore: number;
};

export function buildDpeSearchQuery(property: PropertyRow): string {
  const parts = [property.postalCode, property.city].filter(Boolean);
  return parts.join(" ").trim() || property.city;
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreDpeCandidate(
  property: PropertyRow,
  candidate: DpeSearchResult
): number {
  let score = (candidate.addressMatchScore ?? 0) * 10;

  if (property.dpeClass && candidate.dpeClass === property.dpeClass) {
    score += 50;
  }
  if (property.gesClass && candidate.gesClass === property.gesClass) {
    score += 30;
  }

  if (property.surface && candidate.surfaceM2) {
    const diff =
      Math.abs(property.surface - candidate.surfaceM2) / property.surface;
    if (diff <= 0.15) {
      score += 40 * (1 - diff / 0.15);
    }
  }

  if (
    property.latitude !== null &&
    property.longitude !== null &&
    candidate.latitude !== null &&
    candidate.longitude !== null
  ) {
    const distKm = haversineDistanceKm(
      property.latitude,
      property.longitude,
      candidate.latitude,
      candidate.longitude
    );
    if (distKm <= 2) {
      score += 40 * (1 - distKm / 2);
    }
  }

  return score;
}

export function rankDpeCandidates(
  property: PropertyRow,
  candidates: DpeSearchResult[],
  limit = 5
): RankedDpeSearchResult[] {
  const byAddress = new Map<string, RankedDpeSearchResult>();

  for (const candidate of candidates) {
    const key = normalizeAddress(candidate.address);
    const ranked = { ...candidate, matchScore: scoreDpeCandidate(property, candidate) };
    const existing = byAddress.get(key);
    if (!existing || ranked.matchScore > existing.matchScore) {
      byAddress.set(key, ranked);
    }
  }

  return [...byAddress.values()]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
