import type {
  CompatibilityCalibration,
  CompatibilityModel,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { learnCompatibilityPreferences } from "./learn.js";
import { evaluatePropertyCompatibility } from "./evaluate.js";
import { learnCriterionWeights } from "./weights.js";

const CALIBRATION_MIN_SPREAD = 10;
const MIN_DISLIKES_FOR_DISTRIBUTION_TIERS = 2;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function scoreTrainingProperty(
  property: PropertyRow,
  model: CompatibilityModel,
  options: { excludeLikeId?: number; excludeDislikeId?: number }
): number | undefined {
  const likes =
    options.excludeLikeId !== undefined
      ? model.likes.filter((like) => like.id !== options.excludeLikeId)
      : model.likes;
  const dislikes =
    options.excludeDislikeId !== undefined
      ? model.dislikes.filter(
          (dislike) => dislike.id !== options.excludeDislikeId
        )
      : model.dislikes;

  if (likes.length === 0) return undefined;

  return evaluatePropertyCompatibility(property, {
    ...model,
    likes,
    dislikes,
    likeCount: likes.length,
    dislikeCount: dislikes.length,
  })?.score;
}

function buildCalibration(
  likes: PropertyRow[],
  dislikes: PropertyRow[],
  model: CompatibilityModel
): CompatibilityCalibration | null {
  const likeScores = likes
    .map((like) =>
      scoreTrainingProperty(like, model, { excludeLikeId: like.id })
    )
    .filter((score): score is number => score !== undefined);
  const dislikeScores = dislikes
    .map((dislike) =>
      scoreTrainingProperty(dislike, model, { excludeDislikeId: dislike.id })
    )
    .filter((score): score is number => score !== undefined);

  if (likeScores.length === 0) return null;

  const scoreMax =
    likeScores.length >= 5 ? percentile(likeScores, 0.75) : median(likeScores);
  const scoreMin =
    dislikeScores.length >= 3
      ? percentile(dislikeScores, 0.25)
      : dislikeScores.length > 0
        ? median(dislikeScores)
        : Math.min(...likeScores) * 0.85;

  const spread = scoreMax - scoreMin;
  const signalStrongEnough =
    spread >= CALIBRATION_MIN_SPREAD ||
    (likes.length >= 3 &&
      dislikes.length >= MIN_DISLIKES_FOR_DISTRIBUTION_TIERS);

  return {
    scoreMin,
    scoreMax,
    signalStrongEnough,
    likeScores,
    dislikeScores,
  };
}

export function buildCompatibilityModel(
  likes: PropertyRow[],
  dislikes: PropertyRow[] = []
): CompatibilityModel | null {
  if (likes.length === 0) return null;

  const profile = learnCompatibilityPreferences(likes, dislikes);
  if (!profile) return null;

  const weights = learnCriterionWeights(likes, dislikes);
  const draft: CompatibilityModel = {
    likes,
    dislikes,
    likeCount: likes.length,
    dislikeCount: dislikes.length,
    weights,
    profile,
    calibration: null,
  };

  const calibration = buildCalibration(likes, dislikes, draft);

  return {
    ...draft,
    calibration,
  };
}
