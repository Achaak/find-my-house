import type {
  CompatibilityBreakdown,
  CompatibilityPreferences,
  CompatibilityResult,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import {
  normalizeEnergyClass,
  type EnergyClass,
} from "../energy/energyClass.js";
import { haversineDistanceKm, type GeoPoint } from "../geo/geo.js";

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

const CRITERION_WEIGHTS = {
  price: 25,
  surface: 20,
  landSurface: 20,
  rooms: 10,
  bedrooms: 10,
  dpe: 10,
  ancien: 5,
  distance: 10,
} as const;

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

export function scorePropertyCompatibility(
  property: PropertyRow,
  preferences: CompatibilityPreferences
): CompatibilityResult | null {
  const breakdown: CompatibilityBreakdown = {
    price:
      preferences.idealPrice !== undefined
        ? scorePrice(
            property.price,
            preferences.idealPrice,
            preferences.maxPrice ?? preferences.idealPrice * 1.25
          )
        : null,
    surface:
      preferences.minSurface !== undefined &&
      preferences.idealSurface !== undefined
        ? scoreNumericTarget(
            property.surface,
            preferences.minSurface,
            preferences.idealSurface
          )
        : null,
    landSurface:
      preferences.minLandSurface !== undefined &&
      preferences.idealLandSurface !== undefined
        ? scoreNumericTarget(
            property.landSurface,
            preferences.minLandSurface,
            preferences.idealLandSurface
          )
        : null,
    rooms: scoreRoomsTarget(
      property.rooms,
      preferences.minRooms,
      preferences.idealRooms
    ),
    bedrooms: scoreRoomsTarget(
      property.bedrooms,
      preferences.minBedrooms,
      preferences.idealBedrooms
    ),
    dpe: scoreDpeClass(property.dpeClass, preferences.idealDpeClass),
    ancien: scoreAncienPreference(
      property.isNewProperty,
      preferences.ancienOnly
    ),
    distance: scoreDistance(
      property,
      preferences.referencePoint,
      preferences.maxDistanceKm
    ),
    dislikePenalty: scoreDislikePenalty(property, preferences.dislikes),
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(CRITERION_WEIGHTS) as [
    Exclude<keyof CompatibilityBreakdown, "dislikePenalty">,
    number,
  ][]) {
    const criterionScore = breakdown[key];
    if (criterionScore === null) continue;
    weightedSum += criterionScore * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  const baseScore = weightedSum / totalWeight;
  const penalty = breakdown.dislikePenalty ?? 0;
  const score = clampScore(baseScore - penalty);

  return { score, breakdown };
}

export function compareCompatibility(
  a: PropertyRow,
  b: PropertyRow,
  preferences: CompatibilityPreferences | null
): number {
  if (!preferences) return 0;

  const scoreA = scorePropertyCompatibility(a, preferences)?.score ?? 0;
  const scoreB = scorePropertyCompatibility(b, preferences)?.score ?? 0;
  return scoreB - scoreA;
}

export function sortByCompatibility<T extends PropertyRow>(
  properties: T[],
  preferences: CompatibilityPreferences | null
): T[] {
  if (!preferences) return properties;
  return [...properties].sort((a, b) =>
    compareCompatibility(a, b, preferences)
  );
}

export function formatCompatibilityLabel(score: number): string {
  const rounded = Math.round(score);
  const emoji =
    rounded >= 85 ? "🟢" : rounded >= 70 ? "🟡" : rounded >= 50 ? "🟠" : "🔴";
  return `${emoji} ${String(rounded)}/100`;
}
