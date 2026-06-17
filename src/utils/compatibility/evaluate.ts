import type {
  CompatibilityBreakdownRecord,
  CompatibilityCriterion,
  CompatibilityEvaluation,
  CompatibilityFactor,
  CompatibilityModel,
} from "../../types/compatibility.js";
import type { PropertyRow } from "../../types/listing.js";
import { averageLikeSimilarity, maxDislikeSimilarity } from "./criteria.js";

const DISLIKE_BLEND = 0.5;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function sentimentForScore(score: number): CompatibilityFactor["sentiment"] {
  if (score >= 70) return "positive";
  if (score <= 40) return "negative";
  return "neutral";
}

export const CRITERION_FACTOR_LABELS: Record<
  CompatibilityCriterion,
  { positive: string; negative: string; neutral: string }
> = {
  price: {
    positive: "Prix proche de tes likes",
    negative: "Prix éloigné de tes likes",
    neutral: "Prix dans une fourchette moyenne",
  },
  surface: {
    positive: "Surface proche de tes likes",
    negative: "Surface en dessous de tes likes",
    neutral: "Surface correcte",
  },
  landSurface: {
    positive: "Terrain proche de tes likes",
    negative: "Terrain plus petit que tes likes",
    neutral: "Terrain acceptable",
  },
  rooms: {
    positive: "Nombre de pièces proche de tes likes",
    negative: "Moins de pièces que tes likes",
    neutral: "Nombre de pièces correct",
  },
  bedrooms: {
    positive: "Chambres proches de tes likes",
    negative: "Moins de chambres que tes likes",
    neutral: "Nombre de chambres correct",
  },
  bathrooms: {
    positive: "Salles de bain proches de tes likes",
    negative: "Moins de salles de bain que tes likes",
    neutral: "Salles de bain correctes",
  },
  parkingSpaces: {
    positive: "Stationnement proche de tes likes",
    negative: "Moins de stationnement que tes likes",
    neutral: "Stationnement correct",
  },
  constructionYear: {
    positive: "Année de construction proche de tes likes",
    negative: "Année de construction éloignée",
    neutral: "Année de construction acceptable",
  },
  highlights: {
    positive: "Équipements proches de tes likes",
    negative: "Peu d'équipements en commun",
    neutral: "Quelques équipements en commun",
  },
  condition: {
    positive: "État proche de tes likes",
    negative: "État différent de tes likes",
    neutral: "État acceptable",
  },
  heating: {
    positive: "Chauffage proche de tes likes",
    negative: "Chauffage différent de tes likes",
    neutral: "Chauffage acceptable",
  },
  orientation: {
    positive: "Orientation proche de tes likes",
    negative: "Orientation différente de tes likes",
    neutral: "Orientation acceptable",
  },
  dpe: {
    positive: "DPE proche de tes likes",
    negative: "DPE moins bon que tes likes",
    neutral: "DPE acceptable",
  },
  ancien: {
    positive: "Neuf/ancien aligné avec tes likes",
    negative: "Neuf/ancien différent de tes likes",
    neutral: "Neuf/ancien acceptable",
  },
  distance: {
    positive: "Zone géographique proche de tes likes",
    negative: "Plus éloigné que tes likes",
    neutral: "Distance géographique moyenne",
  },
};

function buildFactor(
  criterion: CompatibilityCriterion,
  score: number,
  weight: number
): CompatibilityFactor {
  const labels = CRITERION_FACTOR_LABELS[criterion];
  const sentiment = sentimentForScore(score);
  return {
    criterion,
    label: labels[sentiment],
    sentiment,
    score,
    weight,
  };
}

export function evaluatePropertyCompatibility(
  property: PropertyRow,
  model: CompatibilityModel
): CompatibilityEvaluation | null {
  const activeCriteria = Object.entries(model.weights).filter(
    (entry): entry is [CompatibilityCriterion, number] =>
      typeof entry[1] === "number" && entry[1] > 0
  );

  if (activeCriteria.length === 0) return null;

  const breakdown = Object.fromEntries(
    activeCriteria.map(([criterion]) => [criterion, null])
  ) as CompatibilityBreakdownRecord;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [criterion, weight] of activeCriteria) {
    const likeSimilarity = averageLikeSimilarity(
      property,
      model.likes,
      criterion
    );
    if (likeSimilarity === null) continue;

    const dislikeSimilarity =
      model.dislikes.length > 0
        ? maxDislikeSimilarity(property, model.dislikes, criterion)
        : null;

    const blended =
      dislikeSimilarity === null
        ? likeSimilarity
        : Math.max(0, likeSimilarity - dislikeSimilarity * DISLIKE_BLEND);

    const score = clampScore(blended * 100);
    breakdown[criterion] = score;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return null;

  const factors = activeCriteria
    .map(([criterion, weight]) => {
      const score = breakdown[criterion];
      if (score === null) return null;
      return buildFactor(criterion, score, weight);
    })
    .filter((factor): factor is CompatibilityFactor => factor !== null)
    .sort(
      (a, b) =>
        b.weight * Math.abs(b.score - 50) - a.weight * Math.abs(a.score - 50)
    );

  return {
    score: clampScore(weightedSum / totalWeight),
    breakdown,
    factors,
  };
}

export function comparePropertyCompatibility(
  a: PropertyRow,
  b: PropertyRow,
  model: CompatibilityModel | null
): number {
  if (!model) return 0;

  const scoreA = evaluatePropertyCompatibility(a, model)?.score ?? 0;
  const scoreB = evaluatePropertyCompatibility(b, model)?.score ?? 0;
  return scoreB - scoreA;
}

export function sortPropertiesByCompatibility<T extends PropertyRow>(
  properties: T[],
  model: CompatibilityModel | null
): T[] {
  if (!model) return properties;
  return [...properties].sort((a, b) =>
    comparePropertyCompatibility(a, b, model)
  );
}
