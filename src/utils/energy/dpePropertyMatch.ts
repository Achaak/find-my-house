import type { PropertyRow } from "../../types/listing.js";
import { haversineDistanceKm } from "../geo/geo.js";
import type { DpeSearchResult } from "./ademeDpeApi.js";
import {
  buildConsumptionRange,
  buildEmissionRange,
  CONSUMPTION_TOLERANCE_KWH,
  EMISSION_TOLERANCE_KG,
} from "./energyMetrics.js";

export type RankedDpeSearchResult = DpeSearchResult & {
  matchScore: number;
};

export type AdemeSearchParams = {
  recent: Record<string, string>;
  legacy: Record<string, string>;
};

export type AdemeSearchVariant = {
  id: string;
  params: AdemeSearchParams;
  /** Surface filter on the ADEME query — last resort when result volume is too high. */
  includeSurfaceFilter: boolean;
};

export type DpeAddressSearchReadiness = "unavailable" | "full" | "degraded";

/** Margin for optional ADEME surface query filter (listing may show floor area, not Carrez). */
export const SURFACE_API_MARGIN_RATIO = 0.25;

/** Margin for surface scoring only — wider than listing vs DPE habitable gap. */
export const SURFACE_SCORE_MARGIN_RATIO = 0.25;

export function buildSurfaceRange(
  surface: number,
  marginRatio: number
): { min: number; max: number } {
  const margin = surface * marginRatio;
  return {
    min: Math.max(0, Math.floor(surface - margin)),
    max: Math.ceil(surface + margin),
  };
}

export function extractDepartmentCode(
  postalCode: string | null | undefined
): string | null {
  if (!postalCode) return null;

  const trimmed = postalCode.trim();
  if (trimmed.startsWith("20")) {
    return trimmed.charAt(2) === "0" ? "2A" : "2B";
  }

  if (/^97[1-8]/.test(trimmed)) {
    return trimmed.slice(0, 3);
  }

  const dept = trimmed.slice(0, 2);
  return /^\d{2}$/.test(dept) ? dept : null;
}

export function getDpeAddressSearchReadiness(
  property: PropertyRow
): DpeAddressSearchReadiness {
  if (!extractDepartmentCode(property.postalCode)) return "unavailable";
  if (!property.dpeClass) return "unavailable";

  const hasPreciseMetrics =
    property.dpeConsumptionKwhM2 !== null || property.gesEmissionKgM2 !== null;

  return hasPreciseMetrics ? "full" : "degraded";
}

export function formatDpeSearchCriteria(property: PropertyRow): string {
  const parts: string[] = [];

  const department = extractDepartmentCode(property.postalCode);
  if (department) parts.push(`dept. ${department}`);

  if (property.dpeClass) parts.push(`DPE ${property.dpeClass}`);
  if (property.gesClass) parts.push(`GES ${property.gesClass}`);

  if (property.dpeConsumptionKwhM2 !== null) {
    parts.push(`${String(property.dpeConsumptionKwhM2)} kWh/m²/an`);
  }

  if (property.gesEmissionKgM2 !== null) {
    parts.push(`${String(property.gesEmissionKgM2)} kg CO₂/m²/an`);
  }

  if (property.surface) {
    parts.push(`${String(property.surface)} m² (classement)`);
  }

  return parts.join(" · ") || property.city;
}

type BuildParamsOptions = {
  consumptionMode: "exact" | "range" | "omit";
  emissionMode: "exact" | "range" | "omit";
  includeGes: boolean;
  includeSurface: boolean;
};

function applyConsumptionFilter(
  recent: Record<string, string>,
  legacy: Record<string, string>,
  consumption: number,
  mode: "exact" | "range"
): void {
  const rounded = Math.round(consumption);
  if (mode === "exact" && Math.abs(consumption - rounded) < 0.05) {
    recent.conso_5_usages_par_m2_ep_eq = String(rounded);
    legacy.consommation_energie_eq = String(rounded);
    return;
  }

  const { min, max } = buildConsumptionRange(consumption);
  recent.conso_5_usages_par_m2_ep_gte = String(min);
  recent.conso_5_usages_par_m2_ep_lte = String(max);
  legacy.consommation_energie_gte = String(min);
  legacy.consommation_energie_lte = String(max);
}

function applyEmissionFilter(
  recent: Record<string, string>,
  consumption: number,
  mode: "exact" | "range"
): void {
  const rounded = Math.round(consumption);
  if (mode === "exact" && Math.abs(consumption - rounded) < 0.05) {
    recent.emission_ges_5_usages_par_m2_eq = String(rounded);
    return;
  }

  const { min, max } = buildEmissionRange(consumption);
  recent.emission_ges_5_usages_par_m2_gte = String(min);
  recent.emission_ges_5_usages_par_m2_lte = String(max);
}

function applySurfaceFilter(
  recent: Record<string, string>,
  legacy: Record<string, string>,
  surface: number
): void {
  const { min, max } = buildSurfaceRange(surface, SURFACE_API_MARGIN_RATIO);
  recent.surface_habitable_logement_gte = String(min);
  recent.surface_habitable_logement_lte = String(max);
  legacy.surface_thermique_lot_gte = String(min);
  legacy.surface_thermique_lot_lte = String(max);
}

export function buildAdemeSearchParams(
  property: PropertyRow,
  options: BuildParamsOptions
): AdemeSearchParams | null {
  const department = extractDepartmentCode(property.postalCode);
  if (!department) return null;

  const recent: Record<string, string> = {
    code_departement_ban_eq: department,
  };
  const legacy: Record<string, string> = {
    tv016_departement_code_eq: department,
  };

  if (property.dpeClass) {
    recent.etiquette_dpe_eq = property.dpeClass;
    legacy.classe_consommation_energie_eq = property.dpeClass;
  }

  if (options.includeGes && property.gesClass) {
    recent.etiquette_ges_eq = property.gesClass;
    legacy.classe_estimation_ges_eq = property.gesClass;
  }

  if (
    options.consumptionMode !== "omit" &&
    property.dpeConsumptionKwhM2 !== null
  ) {
    applyConsumptionFilter(
      recent,
      legacy,
      property.dpeConsumptionKwhM2,
      options.consumptionMode
    );
  }

  if (options.emissionMode !== "omit" && property.gesEmissionKgM2 !== null) {
    applyEmissionFilter(recent, property.gesEmissionKgM2, options.emissionMode);
  }

  if (options.includeSurface && property.surface) {
    applySurfaceFilter(recent, legacy, property.surface);
  }

  return { recent, legacy };
}

function buildVariant(
  property: PropertyRow,
  id: string,
  options: BuildParamsOptions
): AdemeSearchVariant | null {
  const params = buildAdemeSearchParams(property, options);
  if (!params) return null;

  return {
    id,
    params,
    includeSurfaceFilter: options.includeSurface,
  };
}

export function buildAdemeSearchParamVariants(
  property: PropertyRow
): AdemeSearchVariant[] {
  const readiness = getDpeAddressSearchReadiness(property);
  if (readiness === "unavailable") return [];

  if (readiness === "degraded") {
    return [
      buildVariant(property, "degraded", {
        consumptionMode: "omit",
        emissionMode: "omit",
        includeGes: true,
        includeSurface: false,
      }),
      buildVariant(property, "degraded_no_ges", {
        consumptionMode: "omit",
        emissionMode: "omit",
        includeGes: false,
        includeSurface: false,
      }),
      buildVariant(property, "degraded_surface", {
        consumptionMode: "omit",
        emissionMode: "omit",
        includeGes: true,
        includeSurface: true,
      }),
    ].filter((variant): variant is AdemeSearchVariant => variant !== null);
  }

  return [
    buildVariant(property, "strict", {
      consumptionMode: "exact",
      emissionMode: "exact",
      includeGes: true,
      includeSurface: false,
    }),
    buildVariant(property, "relaxed", {
      consumptionMode: "range",
      emissionMode: "range",
      includeGes: true,
      includeSurface: false,
    }),
    buildVariant(property, "relaxed_no_ges", {
      consumptionMode: "range",
      emissionMode: "range",
      includeGes: false,
      includeSurface: false,
    }),
    buildVariant(property, "relaxed_surface", {
      consumptionMode: "range",
      emissionMode: "range",
      includeGes: false,
      includeSurface: true,
    }),
  ].filter((variant): variant is AdemeSearchVariant => variant !== null);
}

function normalizeAddress(address: string): string {
  return address
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePlaceToken(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, "");
}

const PLACE_STOPWORDS = new Set([
  "albatre",
  "annonce",
  "arr",
  "avec",
  "axe",
  "chambre",
  "chambres",
  "comprenant",
  "cote",
  "cuisine",
  "exclusivite",
  "hab",
  "habitable",
  "jeux",
  "longere",
  "maison",
  "pieces",
  "rdc",
  "salon",
  "sejour",
  "superbe",
  "terrain",
  "vendre",
]);

const STREET_PATTERN =
  /\b(?:rue|route|chemin|impasse|avenue|allee|allée|boulevard|place|lieu[- ]dit|hameau)\s+(?:de\s+|du\s+|des\s+|d['']|l['']|la\s+)?([a-zàâäéèêëïîôùûüç0-9][\wàâäéèêëïîôùûüç'-]{2,})/giu;

export function extractPlaceHints(property: PropertyRow): string[] {
  const hints = new Set<string>();

  const addToken = (raw: string) => {
    const token = normalizePlaceToken(raw);
    if (token.length >= 4 && !PLACE_STOPWORDS.has(token)) {
      hints.add(token);
    }
  };

  const addText = (text: string) => {
    for (const part of text.split(/[\s,-]+/)) {
      addToken(part);
    }

    for (const match of text.matchAll(STREET_PATTERN)) {
      const captured = match[1];
      if (captured) addToken(captured);
    }
  };

  if (property.title) addText(property.title);

  if (property.description) {
    addText(property.description);
    for (const segment of property.description.split(/\s*-\s*/)) {
      const trimmed = segment.trim();
      if (!trimmed || /^\d/.test(trimmed)) continue;
      addText(trimmed);
    }
  }

  return [...hints];
}

function scorePlaceHints(property: PropertyRow, address: string): number {
  const normalizedAddress = normalizeAddress(address);
  let score = 0;

  for (const hint of extractPlaceHints(property)) {
    if (normalizedAddress.includes(hint)) {
      score += Math.min(25, 10 + hint.length);
    }
  }

  return score;
}

function scoreGeoProximity(
  property: PropertyRow,
  candidate: DpeSearchResult
): number {
  if (
    property.latitude === null ||
    property.longitude === null ||
    candidate.latitude === null ||
    candidate.longitude === null
  ) {
    return 0;
  }

  const distanceKm = haversineDistanceKm(
    property.latitude,
    property.longitude,
    candidate.latitude,
    candidate.longitude
  );

  if (distanceKm <= 0.5) return 40;
  if (distanceKm <= 2) return 25;
  if (distanceKm <= 5) return 10;
  return 0;
}

function scoreConstructionYear(
  property: PropertyRow,
  candidate: DpeSearchResult
): number {
  if (
    property.constructionYear === null ||
    candidate.constructionYear === null
  ) {
    return 0;
  }

  const diff = Math.abs(property.constructionYear - candidate.constructionYear);
  if (diff === 0) return 10;
  if (diff <= 5) return 5;
  return 0;
}

function consumptionWithinTolerance(
  expected: number,
  actual: number | null,
  tolerance = CONSUMPTION_TOLERANCE_KWH
): boolean {
  if (actual === null) return false;
  return Math.abs(expected - actual) <= tolerance;
}

function emissionWithinTolerance(
  expected: number,
  actual: number | null,
  tolerance = EMISSION_TOLERANCE_KG
): boolean {
  if (actual === null) return false;
  return Math.abs(expected - actual) <= tolerance;
}

export function isDpeCandidateEligible(
  property: PropertyRow,
  candidate: DpeSearchResult
): boolean {
  const department = extractDepartmentCode(property.postalCode);
  if (!department) return false;

  if (
    candidate.departmentCode &&
    candidate.departmentCode.toUpperCase() !== department.toUpperCase()
  ) {
    return false;
  }

  if (property.dpeClass && candidate.dpeClass !== property.dpeClass) {
    return false;
  }

  if (property.gesClass && candidate.gesClass !== property.gesClass) {
    return false;
  }

  if (
    property.dpeConsumptionKwhM2 !== null &&
    !consumptionWithinTolerance(
      property.dpeConsumptionKwhM2,
      candidate.consumptionKwhM2Year
    )
  ) {
    return false;
  }

  if (
    property.gesEmissionKgM2 !== null &&
    !emissionWithinTolerance(
      property.gesEmissionKgM2,
      candidate.emissionGesKgM2Year
    )
  ) {
    return false;
  }

  return true;
}

export function scoreDpeCandidate(
  property: PropertyRow,
  candidate: DpeSearchResult
): number {
  let score = 0;

  if (property.dpeClass && candidate.dpeClass === property.dpeClass) {
    score += 30;
  }

  if (property.gesClass && candidate.gesClass === property.gesClass) {
    score += 30;
  }

  if (
    property.dpeConsumptionKwhM2 !== null &&
    candidate.consumptionKwhM2Year !== null
  ) {
    const diff = Math.abs(
      property.dpeConsumptionKwhM2 - candidate.consumptionKwhM2Year
    );
    score += Math.max(0, 50 * (1 - diff / CONSUMPTION_TOLERANCE_KWH));
  }

  if (
    property.gesEmissionKgM2 !== null &&
    candidate.emissionGesKgM2Year !== null
  ) {
    const diff = Math.abs(
      property.gesEmissionKgM2 - candidate.emissionGesKgM2Year
    );
    score += Math.max(0, 30 * (1 - diff / EMISSION_TOLERANCE_KG));
  }

  if (property.surface && candidate.surfaceM2 !== null) {
    const diff = Math.abs(property.surface - candidate.surfaceM2);
    const margin = property.surface * SURFACE_SCORE_MARGIN_RATIO || 1;
    score += Math.max(0, 20 * (1 - diff / margin));
  }

  score += scoreGeoProximity(property, candidate);
  score += scorePlaceHints(property, candidate.address);
  score += scoreConstructionYear(property, candidate);

  if (candidate.establishmentDate) {
    const ageMs = Date.now() - Date.parse(candidate.establishmentDate);
    if (
      Number.isFinite(ageMs) &&
      ageMs >= 0 &&
      ageMs < 1000 * 60 * 60 * 24 * 365 * 2
    ) {
      score += 5;
    }
  }

  return score;
}

export function rankDpeCandidates(
  property: PropertyRow,
  candidates: DpeSearchResult[],
  limit = 5
): RankedDpeSearchResult[] {
  const byAddress = new Map<string, RankedDpeSearchResult>();

  for (const candidate of candidates) {
    if (!isDpeCandidateEligible(property, candidate)) continue;

    const key = normalizeAddress(candidate.address);
    const ranked = {
      ...candidate,
      matchScore: scoreDpeCandidate(property, candidate),
    };
    const existing = byAddress.get(key);
    if (!existing || ranked.matchScore > existing.matchScore) {
      byAddress.set(key, ranked);
    }
  }

  return [...byAddress.values()]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}
