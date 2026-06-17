import type { EnergyClass } from "../utils/energy/energyClass.js";
import type { GeoPoint } from "../utils/geo/geo.js";
import type { PropertyRow } from "./listing.js";

export type CompatibilityCriterion =
  | "price"
  | "surface"
  | "landSurface"
  | "rooms"
  | "bedrooms"
  | "bathrooms"
  | "parkingSpaces"
  | "constructionYear"
  | "highlights"
  | "condition"
  | "heating"
  | "orientation"
  | "dpe"
  | "ancien"
  | "distance";

export const COMPATIBILITY_CRITERIA = [
  "price",
  "surface",
  "landSurface",
  "rooms",
  "bedrooms",
  "bathrooms",
  "parkingSpaces",
  "constructionYear",
  "highlights",
  "condition",
  "heating",
  "orientation",
  "dpe",
  "ancien",
  "distance",
] as const satisfies readonly CompatibilityCriterion[];

export type CompatibilityReadiness = "none" | "scoring" | "tier" | "full";

export type CompatibilityTier = "strong" | "good" | "moderate" | "weak";

export type CompatibilityFactorSentiment = "positive" | "negative" | "neutral";

export type CompatibilityPreferences = {
  maxPrice?: number;
  idealPrice?: number;
  minSurface?: number;
  idealSurface?: number;
  minLandSurface?: number;
  idealLandSurface?: number;
  minRooms?: number;
  idealRooms?: number;
  minBedrooms?: number;
  idealBedrooms?: number;
  minBathrooms?: number;
  idealBathrooms?: number;
  minParkingSpaces?: number;
  idealParkingSpaces?: number;
  idealConstructionYear?: number;
  preferredHighlights?: string[];
  avoidRenovation?: boolean;
  idealHeating?: string;
  idealOrientation?: string;
  idealDpeClass?: EnergyClass;
  ancienOnly?: boolean;
  referencePoint?: GeoPoint;
  maxDistanceKm?: number;
  dislikes?: PropertyRow[];
};

/** @deprecated Use CompatibilityBreakdownRecord */
export type CompatibilityBreakdown = Record<
  CompatibilityCriterion,
  number | null
>;

export type CompatibilityBreakdownRecord = Record<
  CompatibilityCriterion,
  number | null
>;

export type CompatibilityFactor = {
  criterion: CompatibilityCriterion;
  label: string;
  sentiment: CompatibilityFactorSentiment;
  score: number;
  weight: number;
};

export type CompatibilityEvaluation = {
  score: number;
  breakdown: CompatibilityBreakdownRecord;
  factors: CompatibilityFactor[];
};

export type CompatibilityCalibration = {
  scoreMin: number;
  scoreMax: number;
  signalStrongEnough: boolean;
  likeScores: number[];
  dislikeScores: number[];
};

export type CompatibilityModel = {
  likes: PropertyRow[];
  dislikes: PropertyRow[];
  likeCount: number;
  dislikeCount: number;
  weights: Partial<Record<CompatibilityCriterion, number>>;
  profile: CompatibilityPreferences;
  calibration: CompatibilityCalibration | null;
};

export type CompatibilityCard = {
  readiness: CompatibilityReadiness;
  tier?: CompatibilityTier;
  rank?: number;
  rankTotal?: number;
  summary?: string;
};

export type CompatibilityDetail = CompatibilityCard & {
  factors: CompatibilityFactor[];
  breakdown: {
    criterion: CompatibilityCriterion;
    score: number;
    weight: number;
  }[];
};

export type CompatibilityProfileWeightImportance = "high" | "medium" | "low";

export type CompatibilityProfile = {
  readiness: CompatibilityReadiness;
  training: { likes: number; dislikes: number };
  preferences: { label: string; value: string }[];
  weights: {
    criterion: CompatibilityCriterion;
    importance: CompatibilityProfileWeightImportance;
  }[];
};

/** @deprecated Use CompatibilityEvaluation */
export type CompatibilityResult = CompatibilityEvaluation;
