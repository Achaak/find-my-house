import type { PropertyRow } from "../../types/listing.js";
import {
  normalizeEnergyClass,
  type EnergyClass,
} from "../energy/energyClass.js";
import { haversineDistanceKm, type GeoPoint } from "../geo/geo.js";
import { highlightsOverlapRatio } from "./highlights.js";

const DPE_RANK: Record<EnergyClass, number> = {
  A: 7,
  B: 6,
  C: 5,
  D: 4,
  E: 3,
  F: 2,
  G: 1,
  N: 0,
  V: 0,
};

const MAX_DISLIKE_PENALTY = 40;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function scorePrice(
  price: number,
  idealPrice: number,
  maxPrice: number
): number {
  if (price <= idealPrice) return 100;
  if (maxPrice <= idealPrice) return price <= maxPrice ? 100 : 0;
  if (price >= maxPrice) return 0;
  return clampScore(100 * (1 - (price - idealPrice) / (maxPrice - idealPrice)));
}

export function scoreNumericTarget(
  value: number | null,
  min: number,
  ideal: number
): number | null {
  if (value === null) return null;
  if (ideal <= min)
    return value >= ideal ? 100 : clampScore(100 * (value / ideal));
  if (value < min) return clampScore(50 * (value / min));
  if (value >= ideal) return 100;
  return clampScore(50 + (50 * (value - min)) / (ideal - min));
}

export function scoreRoomsTarget(
  value: number | null,
  min: number | undefined,
  ideal: number | undefined
): number | null {
  if (ideal === undefined) return null;
  if (value === null) return null;
  if (value >= ideal) return 100;
  if (min !== undefined && value < min) {
    return clampScore(60 * (value / min));
  }
  const floor = min ?? ideal;
  if (ideal === floor) {
    return clampScore(60 * (value / ideal));
  }
  return clampScore(60 + (40 * (value - floor)) / (ideal - floor));
}

export function scoreDpeClass(
  actual: string | null,
  ideal: EnergyClass | undefined
): number | null {
  if (!ideal) return null;
  const normalized = normalizeEnergyClass(actual);
  if (!normalized) return null;

  const idealRank = DPE_RANK[ideal];
  const actualRank = DPE_RANK[normalized];
  if (actualRank >= idealRank) return 100;

  const steps = idealRank - actualRank;
  return clampScore(100 - steps * 20);
}

export function scoreAncienPreference(
  isNewProperty: boolean | null,
  ancienOnly: boolean | undefined
): number | null {
  if (!ancienOnly) return null;
  if (isNewProperty === false) return 100;
  if (isNewProperty === true) return 0;
  return 50;
}

export function scoreConstructionYear(
  value: number | null,
  ideal: number | undefined
): number | null {
  if (ideal === undefined || value === null) return null;

  const diff = Math.abs(value - ideal);
  if (diff <= 5) return 100;
  if (diff >= 50) return 0;

  return clampScore(100 - ((diff - 5) / 45) * 100);
}

export function scoreHighlightsMatch(
  actual: string[] | null,
  preferred: string[] | undefined
): number | null {
  const ratio = highlightsOverlapRatio(actual, preferred);
  if (ratio === null) return null;
  return clampScore(ratio * 100);
}

export function scoreRenovationCondition(
  condition: string | null,
  avoidRenovation: boolean | undefined
): number | null {
  if (!avoidRenovation) return null;
  if (!condition) return 75;
  if (/travaux|rafraîchir|rénov/i.test(condition)) return 0;
  return 100;
}

export function scoreTextPreference(
  actual: string | null,
  ideal: string | undefined
): number | null {
  if (!ideal) return null;
  if (!actual) return null;

  const left = actual.trim().toLowerCase();
  const right = ideal.trim().toLowerCase();
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 80;
  return 0;
}

function relativeDifference(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / scale;
}

export function similarityToProperty(
  property: PropertyRow,
  reference: PropertyRow
): number | null {
  let total = 0;
  let weight = 0;

  const addNumeric = (
    left: number | null,
    right: number | null,
    factor = 1
  ) => {
    if (left === null || right === null) return;
    total += (1 - Math.min(1, relativeDifference(left, right))) * factor;
    weight += factor;
  };

  addNumeric(property.price, reference.price, 2);
  addNumeric(property.surface, reference.surface, 1.5);
  addNumeric(property.landSurface, reference.landSurface, 1.5);
  addNumeric(property.rooms, reference.rooms, 1);
  addNumeric(property.bedrooms, reference.bedrooms, 1);
  addNumeric(property.bathrooms, reference.bathrooms, 1);
  addNumeric(property.parkingSpaces, reference.parkingSpaces, 1);
  addNumeric(property.constructionYear, reference.constructionYear, 1);

  const highlightSimilarity = highlightsOverlapRatio(
    property.highlights,
    reference.highlights
  );
  if (highlightSimilarity !== null) {
    total += highlightSimilarity * 1.5;
    weight += 1.5;
  }

  if (
    property.latitude !== null &&
    property.longitude !== null &&
    reference.latitude !== null &&
    reference.longitude !== null
  ) {
    const distanceKm = haversineDistanceKm(
      property.latitude,
      property.longitude,
      reference.latitude,
      reference.longitude
    );
    total += Math.max(0, 1 - distanceKm / 25) * 2;
    weight += 2;
  }

  if (property.dpeClass && reference.dpeClass) {
    const left = normalizeEnergyClass(property.dpeClass);
    const right = normalizeEnergyClass(reference.dpeClass);
    if (left && right) {
      total += (1 - Math.abs(DPE_RANK[left] - DPE_RANK[right]) / 6) * 1;
      weight += 1;
    }
  }

  if (
    property.isNewProperty !== null &&
    reference.isNewProperty !== null &&
    property.isNewProperty === reference.isNewProperty
  ) {
    total += 1;
    weight += 1;
  }

  if (weight === 0) return null;
  return total / weight;
}

export function scoreDislikePenalty(
  property: PropertyRow,
  dislikes: PropertyRow[] | undefined
): number | null {
  if (!dislikes || dislikes.length === 0) return null;

  const similarities = dislikes
    .map((disliked) => similarityToProperty(property, disliked))
    .filter((value): value is number => value !== null);

  if (similarities.length === 0) return null;

  return clampScore(Math.max(...similarities) * MAX_DISLIKE_PENALTY);
}

export function scoreDistance(
  property: PropertyRow,
  referencePoint: GeoPoint | undefined,
  maxDistanceKm: number | undefined
): number | null {
  if (!referencePoint || maxDistanceKm === undefined || maxDistanceKm <= 0) {
    return null;
  }
  if (property.latitude === null || property.longitude === null) return null;

  const distanceKm = haversineDistanceKm(
    referencePoint.lat,
    referencePoint.lng,
    property.latitude,
    property.longitude
  );
  if (distanceKm <= 0) return 100;
  if (distanceKm >= maxDistanceKm) return 0;
  return clampScore(100 * (1 - distanceKm / maxDistanceKm));
}
