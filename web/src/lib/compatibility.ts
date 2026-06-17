import type {
  CompatibilityCard,
  CompatibilityCriterion,
  CompatibilityDetail,
  CompatibilityProfileWeightImportance,
  CompatibilityTier,
} from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

export function compatibilityTierLabel(tier: CompatibilityTier): string {
  switch (tier) {
    case "strong":
      return m.compatibility_tier_strong();
    case "good":
      return m.compatibility_tier_good();
    case "moderate":
      return m.compatibility_tier_moderate();
    case "weak":
      return m.compatibility_tier_weak();
  }
}

export function compatibilityCriterionLabel(
  criterion: CompatibilityCriterion
): string {
  switch (criterion) {
    case "price":
      return m.compatibility_criterion_price();
    case "surface":
      return m.compatibility_criterion_surface();
    case "landSurface":
      return m.compatibility_criterion_landSurface();
    case "rooms":
      return m.compatibility_criterion_rooms();
    case "bedrooms":
      return m.compatibility_criterion_bedrooms();
    case "bathrooms":
      return m.compatibility_criterion_bathrooms();
    case "parkingSpaces":
      return m.compatibility_criterion_parkingSpaces();
    case "constructionYear":
      return m.compatibility_criterion_constructionYear();
    case "highlights":
      return m.compatibility_criterion_highlights();
    case "condition":
      return m.compatibility_criterion_condition();
    case "heating":
      return m.compatibility_criterion_heating();
    case "orientation":
      return m.compatibility_criterion_orientation();
    case "dpe":
      return m.compatibility_criterion_dpe();
    case "ancien":
      return m.compatibility_criterion_ancien();
    case "distance":
      return m.compatibility_criterion_distance();
  }
}

export function compatibilityImportanceLabel(
  importance: CompatibilityProfileWeightImportance
): string {
  switch (importance) {
    case "high":
      return m.compatibility_importance_high();
    case "medium":
      return m.compatibility_importance_medium();
    case "low":
      return m.compatibility_importance_low();
  }
}

export function formatCompatibilityProfileTraining(
  likes: number,
  dislikes: number
): string {
  if (dislikes > 0) {
    return m.compatibility_profile_training({ likes, dislikes });
  }
  return m.compatibility_profile_training_likes_only({ likes });
}

export function formatCompatibilityRank(
  card: CompatibilityCard
): string | null {
  if (card.rank === undefined || card.rankTotal === undefined) return null;
  return m.compatibility_rank({
    rank: card.rank,
    total: card.rankTotal,
  });
}

export function formatCompatibilityBadge(
  card: CompatibilityCard
): string | null {
  if (!card.tier) return null;
  return compatibilityTierLabel(card.tier);
}

export function hasCompatibilityPresentation(
  compatibility: CompatibilityCard | CompatibilityDetail | undefined
): compatibility is CompatibilityCard {
  return compatibility !== undefined && compatibility.readiness !== "none";
}
