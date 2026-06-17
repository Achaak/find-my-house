import {
  COMPATIBILITY_CRITERIA,
  type CompatibilityCriterion,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { criterionPresent } from "./criteria.js";

const MIN_LIKES_FOR_DISCRIMINANT_WEIGHTS = 5;
const MIN_DISLIKES_FOR_DISCRIMINANT = 2;
const MISSING_RATIO_THRESHOLD = 0.5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function normalizedSpread(values: number[]): number {
  if (values.length < 2) return 0;

  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg === 0) return 0;

  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(avg);
}

function numericExtractor(
  property: PropertyRow,
  criterion: CompatibilityCriterion
): number | null {
  switch (criterion) {
    case "price":
      return property.price;
    case "surface":
      return property.surface;
    case "landSurface":
      return property.landSurface;
    case "rooms":
      return property.rooms;
    case "bedrooms":
      return property.bedrooms;
    case "bathrooms":
      return property.bathrooms;
    case "parkingSpaces":
      return property.parkingSpaces;
    case "constructionYear":
      return property.constructionYear;
    case "dpe":
      return property.dpeClass ? property.dpeClass.charCodeAt(0) : null;
    case "distance":
      return property.latitude;
    default:
      return null;
  }
}

function categoricalSpread(
  listings: PropertyRow[],
  criterion: CompatibilityCriterion
): number {
  const values = listings
    .map((listing) => {
      switch (criterion) {
        case "highlights":
          return listing.highlights?.length ?? 0;
        case "condition":
          return listing.propertyCondition ? 1 : 0;
        case "heating":
          return listing.heating ? 1 : 0;
        case "orientation":
          return listing.orientation ? 1 : 0;
        case "ancien":
          return listing.isNewProperty === null
            ? null
            : listing.isNewProperty
              ? 1
              : 0;
        default:
          return null;
      }
    })
    .filter((value): value is number => value !== null);

  return normalizedSpread(values);
}

function likeVarianceSignal(
  likes: PropertyRow[],
  criterion: CompatibilityCriterion
): number {
  if (
    criterion === "highlights" ||
    criterion === "condition" ||
    criterion === "heating" ||
    criterion === "orientation" ||
    criterion === "ancien"
  ) {
    return categoricalSpread(likes, criterion);
  }

  const values = likes
    .map((like) => numericExtractor(like, criterion))
    .filter((value): value is number => value !== null && value > 0);

  return normalizedSpread(values);
}

function discriminantGap(
  likes: PropertyRow[],
  dislikes: PropertyRow[],
  criterion: CompatibilityCriterion
): number {
  const likeValues = likes
    .map((like) => numericExtractor(like, criterion))
    .filter((value): value is number => value !== null && value > 0);
  const dislikeValues = dislikes
    .map((dislike) => numericExtractor(dislike, criterion))
    .filter((value): value is number => value !== null && value > 0);

  if (likeValues.length === 0 || dislikeValues.length === 0) {
    if (
      criterion === "highlights" ||
      criterion === "condition" ||
      criterion === "heating" ||
      criterion === "orientation" ||
      criterion === "ancien"
    ) {
      const likeSpread = categoricalSpread(likes, criterion);
      const dislikeSpread = categoricalSpread(dislikes, criterion);
      return Math.max(likeSpread, dislikeSpread, 0.1);
    }
    return 0.1;
  }

  const likeMedian = median(likeValues);
  const dislikeMedian = median(dislikeValues);
  const scale = Math.max(Math.abs(likeMedian), Math.abs(dislikeMedian), 1);
  return Math.abs(likeMedian - dislikeMedian) / scale;
}

function isCriterionActive(
  likes: PropertyRow[],
  criterion: CompatibilityCriterion
): boolean {
  const presentCount = likes.filter((like) =>
    criterionPresent(like, criterion)
  ).length;
  return presentCount / likes.length > MISSING_RATIO_THRESHOLD;
}

export function learnCriterionWeights(
  likes: PropertyRow[],
  dislikes: PropertyRow[] = []
): Partial<Record<CompatibilityCriterion, number>> {
  const useDiscriminant =
    likes.length >= MIN_LIKES_FOR_DISCRIMINANT_WEIGHTS &&
    dislikes.length >= MIN_DISLIKES_FOR_DISCRIMINANT;

  const rawWeights: Partial<Record<CompatibilityCriterion, number>> = {};

  for (const criterion of COMPATIBILITY_CRITERIA) {
    if (!isCriterionActive(likes, criterion)) continue;

    const varianceSignal = likeVarianceSignal(likes, criterion);
    const gapSignal = useDiscriminant
      ? discriminantGap(likes, dislikes, criterion)
      : 1;
    const weight = varianceSignal * gapSignal;
    if (weight > 0) {
      rawWeights[criterion] = weight;
    }
  }

  const total = Object.values(rawWeights).reduce(
    (sum, weight) => sum + weight,
    0
  );
  if (total === 0) return rawWeights;

  const activeCriteria = Object.keys(rawWeights) as CompatibilityCriterion[];
  const uniformShare = 100 / activeCriteria.length;
  const blendUniform =
    activeCriteria.length <= 2 ||
    total / Math.max(...Object.values(rawWeights)) > 0.85;

  const blended: Partial<Record<CompatibilityCriterion, number>> = {};
  for (const criterion of activeCriteria) {
    const learnedShare = ((rawWeights[criterion] ?? 0) / total) * 100;
    blended[criterion] = blendUniform
      ? learnedShare * 0.65 + uniformShare * 0.35
      : learnedShare;
  }

  const blendedTotal = Object.values(blended).reduce(
    (sum, weight) => sum + weight,
    0
  );
  const normalized: Partial<Record<CompatibilityCriterion, number>> = {};
  for (const [criterion, weight] of Object.entries(blended) as [
    CompatibilityCriterion,
    number,
  ][]) {
    normalized[criterion] = (weight / blendedTotal) * 100;
  }

  return normalized;
}
