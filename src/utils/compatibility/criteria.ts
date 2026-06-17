import type { CompatibilityCriterion } from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import {
  normalizeEnergyClass,
  type EnergyClass,
} from "../energy/energyClass.js";
import { haversineDistanceKm } from "../geo/geo.js";
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

function relativeDifference(a: number, b: number): number {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) / scale;
}

function numericSimilarity(
  left: number | null,
  right: number | null
): number | null {
  if (left === null || right === null) return null;
  return 1 - Math.min(1, relativeDifference(left, right));
}

function textSimilarity(
  left: string | null,
  right: string | null
): number | null {
  if (!left || !right) return null;

  const normalizedLeft = left.trim().toLowerCase();
  const normalizedRight = right.trim().toLowerCase();
  if (normalizedLeft === normalizedRight) return 1;
  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 0.8;
  }
  return 0;
}

function renovationNeeded(condition: string | null): boolean | null {
  if (!condition) return null;
  return /travaux|rafraîchir|rénov/i.test(condition);
}

export function criterionSimilarity(
  property: PropertyRow,
  reference: PropertyRow,
  criterion: CompatibilityCriterion
): number | null {
  switch (criterion) {
    case "price":
      return numericSimilarity(property.price, reference.price);
    case "surface":
      return numericSimilarity(property.surface, reference.surface);
    case "landSurface":
      return numericSimilarity(property.landSurface, reference.landSurface);
    case "rooms":
      return numericSimilarity(property.rooms, reference.rooms);
    case "bedrooms":
      return numericSimilarity(property.bedrooms, reference.bedrooms);
    case "bathrooms":
      return numericSimilarity(property.bathrooms, reference.bathrooms);
    case "parkingSpaces":
      return numericSimilarity(property.parkingSpaces, reference.parkingSpaces);
    case "constructionYear":
      return numericSimilarity(
        property.constructionYear,
        reference.constructionYear
      );
    case "highlights":
      return highlightsOverlapRatio(property.highlights, reference.highlights);
    case "condition": {
      const left = renovationNeeded(property.propertyCondition);
      const right = renovationNeeded(reference.propertyCondition);
      if (left === null || right === null) return null;
      return left === right ? 1 : 0;
    }
    case "heating":
      return textSimilarity(property.heating, reference.heating);
    case "orientation":
      return textSimilarity(property.orientation, reference.orientation);
    case "dpe": {
      const left = normalizeEnergyClass(property.dpeClass);
      const right = normalizeEnergyClass(reference.dpeClass);
      if (!left || !right) return null;
      return 1 - Math.abs(DPE_RANK[left] - DPE_RANK[right]) / 6;
    }
    case "ancien": {
      if (property.isNewProperty === null || reference.isNewProperty === null) {
        return null;
      }
      return property.isNewProperty === reference.isNewProperty ? 1 : 0;
    }
    case "distance": {
      if (
        property.latitude === null ||
        property.longitude === null ||
        reference.latitude === null ||
        reference.longitude === null
      ) {
        return null;
      }
      const distanceKm = haversineDistanceKm(
        property.latitude,
        property.longitude,
        reference.latitude,
        reference.longitude
      );
      return Math.max(0, 1 - distanceKm / 25);
    }
  }
}

export function criterionPresent(
  property: PropertyRow,
  criterion: CompatibilityCriterion
): boolean {
  switch (criterion) {
    case "price":
      return property.price > 0;
    case "surface":
      return property.surface !== null && property.surface > 0;
    case "landSurface":
      return property.landSurface !== null && property.landSurface > 0;
    case "rooms":
      return property.rooms !== null && property.rooms > 0;
    case "bedrooms":
      return property.bedrooms !== null && property.bedrooms > 0;
    case "bathrooms":
      return property.bathrooms !== null && property.bathrooms > 0;
    case "parkingSpaces":
      return property.parkingSpaces !== null && property.parkingSpaces >= 0;
    case "constructionYear":
      return (
        property.constructionYear !== null && property.constructionYear > 0
      );
    case "highlights":
      return (property.highlights?.length ?? 0) > 0;
    case "condition":
      return Boolean(property.propertyCondition);
    case "heating":
      return Boolean(property.heating);
    case "orientation":
      return Boolean(property.orientation);
    case "dpe":
      return Boolean(normalizeEnergyClass(property.dpeClass));
    case "ancien":
      return property.isNewProperty !== null;
    case "distance":
      return property.latitude !== null && property.longitude !== null;
  }
}

export function averageLikeSimilarity(
  property: PropertyRow,
  likes: PropertyRow[],
  criterion: CompatibilityCriterion
): number | null {
  const values = likes
    .map((like) => criterionSimilarity(property, like, criterion))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function maxDislikeSimilarity(
  property: PropertyRow,
  dislikes: PropertyRow[],
  criterion: CompatibilityCriterion
): number | null {
  const values = dislikes
    .map((dislike) => criterionSimilarity(property, dislike, criterion))
    .filter((value): value is number => value !== null);

  if (values.length === 0) return null;
  return Math.max(...values);
}
