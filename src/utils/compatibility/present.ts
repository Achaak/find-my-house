import type {
  CompatibilityCalibration,
  CompatibilityCard,
  CompatibilityDetail,
  CompatibilityEvaluation,
  CompatibilityFactor,
  CompatibilityModel,
  CompatibilityProfile,
  CompatibilityProfileWeightImportance,
  CompatibilityReadiness,
  CompatibilityTier,
  CompatibilityCriterion,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";

export const MIN_LIKES_FOR_TIER = 3;
export const MIN_LIKES_FOR_RANK = 5;

function normalizeScore(
  score: number,
  calibration: CompatibilityCalibration
): number {
  const span = calibration.scoreMax - calibration.scoreMin;
  if (span <= 0) return 50;
  return ((score - calibration.scoreMin) / span) * 100;
}

function readinessForModel(
  model: CompatibilityModel | null
): CompatibilityReadiness {
  if (!model) return "none";
  if (model.likeCount < MIN_LIKES_FOR_TIER) return "scoring";
  if (!model.calibration) return "scoring";
  if (!model.calibration.signalStrongEnough && model.dislikeCount < 2) {
    return "scoring";
  }
  if (model.likeCount >= MIN_LIKES_FOR_RANK) return "full";
  return "tier";
}

function percentileValue(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

function scoreToTierFromDistribution(
  score: number,
  calibration: CompatibilityCalibration
): CompatibilityTier | undefined {
  const { likeScores, dislikeScores } = calibration;
  if (likeScores.length < 3 || dislikeScores.length < 2) return undefined;

  const likeP75 = percentileValue(likeScores, 0.75);
  const likeP50 = percentileValue(likeScores, 0.5);
  const dislikeP50 = percentileValue(dislikeScores, 0.5);

  if (score >= likeP75) return "strong";
  if (score >= likeP50) return "good";
  if (score >= dislikeP50) return "moderate";
  return "weak";
}

export function scoreToTier(
  score: number,
  model: CompatibilityModel
): CompatibilityTier | undefined {
  const calibration = model.calibration;
  if (!calibration) return undefined;

  const spread = calibration.scoreMax - calibration.scoreMin;
  if (calibration.signalStrongEnough && spread >= 10) {
    const normalized = normalizeScore(score, calibration);
    if (normalized >= 75) return "strong";
    if (normalized >= 50) return "good";
    if (normalized >= 25) return "moderate";
    return "weak";
  }

  return scoreToTierFromDistribution(score, calibration);
}

function pickSummaryFactors(
  factors: CompatibilityFactor[]
): CompatibilityFactor[] {
  const positives = factors
    .filter((factor) => factor.sentiment === "positive")
    .slice(0, 2);
  const negatives = factors
    .filter((factor) => factor.sentiment === "negative")
    .slice(0, 1);

  return [...positives, ...negatives];
}

function shortenFactorLabel(label: string): string {
  return label.replace(" de tes likes", "").replace(" que tes likes", "");
}

export function buildCompatibilitySummary(
  factors: CompatibilityFactor[]
): string | undefined {
  const selected = pickSummaryFactors(factors);
  if (selected.length === 0) return undefined;

  const positives = selected
    .filter((factor) => factor.sentiment === "positive")
    .map((factor) => shortenFactorLabel(factor.label).toLowerCase());
  const negatives = selected
    .filter((factor) => factor.sentiment === "negative")
    .map((factor) => shortenFactorLabel(factor.label).toLowerCase());

  if (positives.length > 0 && negatives.length > 0) {
    return `${capitalize(positives.join(" et "))} ; ${negatives[0]}`;
  }
  if (positives.length > 0) {
    return capitalize(positives.join(" et "));
  }
  if (negatives.length > 0) {
    return capitalize(negatives[0] ?? "");
  }
  return undefined;
}

function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildCompatibilityCard(
  evaluation: CompatibilityEvaluation | null,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityCard | undefined {
  const readiness = readinessForModel(model);
  if (readiness === "none" || !evaluation || !model) return undefined;

  const card: CompatibilityCard = { readiness };

  if (readiness === "scoring") {
    return card;
  }

  const tier = scoreToTier(evaluation.score, model);
  if (tier) {
    card.tier = tier;
    card.summary = buildCompatibilitySummary(evaluation.factors);
  }

  if (readiness === "full" && rank && model.likeCount >= MIN_LIKES_FOR_RANK) {
    card.rank = rank.rank;
    card.rankTotal = rank.rankTotal;
  }

  return card;
}

export function buildCompatibilityDetail(
  evaluation: CompatibilityEvaluation | null,
  model: CompatibilityModel | null,
  rank?: { rank: number; rankTotal: number }
): CompatibilityDetail | undefined {
  const card = buildCompatibilityCard(evaluation, model, rank);
  if (!card || !evaluation || !model) return undefined;

  return {
    ...card,
    factors: evaluation.factors.slice(0, 5),
    breakdown: Object.entries(evaluation.breakdown)
      .filter(([, score]) => score !== null)
      .map(([criterion, score]) => ({
        criterion: criterion as CompatibilityCriterion,
        score: score ?? 0,
        weight: model.weights[criterion as CompatibilityCriterion] ?? 0,
      }))
      .sort((a, b) => b.weight - a.weight),
  };
}

function formatProfilePrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

function weightImportance(
  weight: number,
  maxWeight: number
): CompatibilityProfileWeightImportance {
  if (maxWeight <= 0) return "low";
  const ratio = weight / maxWeight;
  if (ratio >= 0.66) return "high";
  if (ratio >= 0.33) return "medium";
  return "low";
}

const CRITERION_PROFILE_LABELS: Record<CompatibilityCriterion, string> = {
  price: "Prix",
  surface: "Surface",
  landSurface: "Terrain",
  rooms: "Pièces",
  bedrooms: "Chambres",
  bathrooms: "Salles de bain",
  parkingSpaces: "Stationnement",
  constructionYear: "Année de construction",
  highlights: "Équipements",
  condition: "État",
  heating: "Chauffage",
  orientation: "Orientation",
  dpe: "DPE",
  ancien: "Neuf / ancien",
  distance: "Zone géographique",
};

function formatProfileValue(
  label: string,
  profile: CompatibilityModel["profile"]
): string | undefined {
  switch (label) {
    case "Prix":
      return profile.idealPrice !== undefined
        ? `~${formatProfilePrice(profile.idealPrice)}`
        : undefined;
    case "Surface":
      return profile.idealSurface !== undefined
        ? `~${String(Math.round(profile.idealSurface))} m²`
        : undefined;
    case "Terrain":
      return profile.idealLandSurface !== undefined
        ? `~${String(Math.round(profile.idealLandSurface))} m²`
        : undefined;
    case "Pièces":
      return profile.idealRooms !== undefined
        ? `~${String(Math.round(profile.idealRooms))}`
        : undefined;
    case "Chambres":
      return profile.idealBedrooms !== undefined
        ? `~${String(Math.round(profile.idealBedrooms))}`
        : undefined;
    case "Salles de bain":
      return profile.idealBathrooms !== undefined
        ? `~${String(Math.round(profile.idealBathrooms))}`
        : undefined;
    case "Stationnement":
      return profile.idealParkingSpaces !== undefined
        ? `~${String(Math.round(profile.idealParkingSpaces))}`
        : undefined;
    case "Année de construction":
      return profile.idealConstructionYear !== undefined
        ? `~${String(profile.idealConstructionYear)}`
        : undefined;
    case "DPE":
      return profile.idealDpeClass;
    case "Chauffage":
      return profile.idealHeating;
    case "Orientation":
      return profile.idealOrientation;
    case "Équipements":
      return profile.preferredHighlights?.join(", ");
    case "État":
      return profile.avoidRenovation ? "Éviter les travaux" : undefined;
    case "Neuf / ancien":
      return profile.ancienOnly ? "Ancien" : undefined;
    case "Zone géographique":
      return profile.maxDistanceKm !== undefined
        ? `Rayon ~${String(Math.round(profile.maxDistanceKm))} km`
        : undefined;
    default:
      return undefined;
  }
}

export function buildCompatibilityProfile(
  model: CompatibilityModel | null
): CompatibilityProfile {
  const readiness = readinessForModel(model);
  if (!model) {
    return {
      readiness: "none",
      training: { likes: 0, dislikes: 0 },
      preferences: [],
      weights: [],
    };
  }

  const preferences = Object.values(CRITERION_PROFILE_LABELS)
    .map((label) => ({
      label,
      value: formatProfileValue(label, model.profile),
    }))
    .filter(
      (entry): entry is { label: string; value: string } =>
        entry.value !== undefined && entry.value.length > 0
    );

  const weightValues = Object.values(model.weights);
  const maxWeight = weightValues.length > 0 ? Math.max(...weightValues) : 0;

  const weights = Object.entries(model.weights)
    .map(([criterion, weight]) => ({
      criterion: criterion as CompatibilityCriterion,
      importance: weightImportance(weight, maxWeight),
    }))
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 } as const;
      return order[a.importance] - order[b.importance];
    });

  return {
    readiness,
    training: {
      likes: model.likeCount,
      dislikes: model.dislikeCount,
    },
    preferences,
    weights,
  };
}

export function assignCompatibilityRanks(
  properties: PropertyRow[],
  model: CompatibilityModel | null,
  evaluate: (
    property: PropertyRow,
    model: CompatibilityModel
  ) => CompatibilityEvaluation | null
): Map<number, { rank: number; rankTotal: number }> {
  const ranks = new Map<number, { rank: number; rankTotal: number }>();
  if (!model || model.likeCount < MIN_LIKES_FOR_RANK) return ranks;

  const scored = properties
    .map((property) => ({
      property,
      evaluation: evaluate(property, model),
    }))
    .filter(
      (
        entry
      ): entry is {
        property: PropertyRow;
        evaluation: CompatibilityEvaluation;
      } => entry.evaluation !== null
    )
    .sort((a, b) => b.evaluation.score - a.evaluation.score);

  scored.forEach((entry, index) => {
    ranks.set(entry.property.id, {
      rank: index + 1,
      rankTotal: scored.length,
    });
  });

  return ranks;
}

export function formatCompatibilityTierLabel(tier: CompatibilityTier): string {
  switch (tier) {
    case "strong":
      return "Forte adéquation";
    case "good":
      return "Bonne adéquation";
    case "moderate":
      return "Adéquation moyenne";
    case "weak":
      return "Faible adéquation";
  }
}

export function formatCompatibilityTierEmoji(tier: CompatibilityTier): string {
  switch (tier) {
    case "strong":
      return "🟢";
    case "good":
      return "🟡";
    case "moderate":
      return "🟠";
    case "weak":
      return "🔴";
  }
}

export function formatCompatibilityFieldValue(
  card: CompatibilityCard
): string | undefined {
  if (!card.tier) return undefined;

  const parts = [
    `${formatCompatibilityTierEmoji(card.tier)} ${formatCompatibilityTierLabel(card.tier)}`,
  ];

  if (card.rank !== undefined && card.rankTotal !== undefined) {
    parts.push(`#${String(card.rank)}/${String(card.rankTotal)}`);
  }
  if (card.summary) {
    parts.push(card.summary);
  }

  return parts.join("\n");
}
