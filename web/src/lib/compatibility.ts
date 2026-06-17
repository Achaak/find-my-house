import type {
  CompatibilityCard,
  CompatibilityCriterion,
  CompatibilityDetail,
  CompatibilityProfileWeightImportance,
  CompatibilityTier,
} from "@find-my-house/api-types";

export const compatibilityTierLabels: Record<CompatibilityTier, string> = {
  strong: "Forte adéquation",
  good: "Bonne adéquation",
  moderate: "Adéquation moyenne",
  weak: "Faible adéquation",
};

export const compatibilityCriterionLabels: Record<
  CompatibilityCriterion,
  string
> = {
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

export const compatibilityImportanceLabels: Record<
  CompatibilityProfileWeightImportance,
  string
> = {
  high: "Beaucoup",
  medium: "Moyennement",
  low: "Peu",
};

export function formatCompatibilityRank(
  card: CompatibilityCard
): string | null {
  if (card.rank === undefined || card.rankTotal === undefined) return null;
  return `#${String(card.rank)} sur ${String(card.rankTotal)}`;
}

export function formatCompatibilityBadge(
  card: CompatibilityCard
): string | null {
  if (!card.tier) return null;
  return compatibilityTierLabels[card.tier];
}

export function hasCompatibilityPresentation(
  compatibility: CompatibilityCard | CompatibilityDetail | undefined
): compatibility is CompatibilityCard {
  return compatibility !== undefined && compatibility.readiness !== "none";
}
