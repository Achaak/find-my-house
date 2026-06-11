import type { PropertyRow } from "../types/listing.js";
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

/** Relative margin applied around the listing surface (±10 %). */
export const SURFACE_MARGIN_RATIO = 0.1;

export function buildSurfaceRange(
  surface: number,
  marginRatio = SURFACE_MARGIN_RATIO
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

export function formatDpeSearchCriteria(property: PropertyRow): string {
  const parts: string[] = [];

  const department = extractDepartmentCode(property.postalCode);
  if (department) parts.push(`dép. ${department}`);

  if (property.dpeClass) parts.push(`DPE ${property.dpeClass}`);
  if (property.gesClass) parts.push(`GES ${property.gesClass}`);

  if (property.dpeConsumptionKwhM2 !== null) {
    parts.push(`${String(property.dpeConsumptionKwhM2)} kWh/m²/an`);
  }

  if (property.gesEmissionKgM2 !== null) {
    parts.push(`${String(property.gesEmissionKgM2)} kg CO₂/m²/an`);
  }

  if (property.surface) {
    const { min, max } = buildSurfaceRange(property.surface);
    parts.push(
      `${String(property.surface)} m² (±${String(Math.round(SURFACE_MARGIN_RATIO * 100))} % → ${String(min)}–${String(max)})`
    );
  }

  return parts.join(" · ") || property.city;
}

export function buildAdemeSearchParams(
  property: PropertyRow
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

  if (property.gesClass) {
    recent.etiquette_ges_eq = property.gesClass;
    legacy.classe_estimation_ges_eq = property.gesClass;
  }

  if (property.dpeConsumptionKwhM2 !== null) {
    const rounded = Math.round(property.dpeConsumptionKwhM2);
    if (Math.abs(property.dpeConsumptionKwhM2 - rounded) < 0.05) {
      recent.conso_5_usages_par_m2_ep_eq = String(rounded);
      legacy.consommation_energie_eq = String(rounded);
    } else {
      const { min, max } = buildConsumptionRange(property.dpeConsumptionKwhM2);
      recent.conso_5_usages_par_m2_ep_gte = String(min);
      recent.conso_5_usages_par_m2_ep_lte = String(max);
      legacy.consommation_energie_gte = String(min);
      legacy.consommation_energie_lte = String(max);
    }
  }

  if (property.gesEmissionKgM2 !== null) {
    const rounded = Math.round(property.gesEmissionKgM2);
    if (Math.abs(property.gesEmissionKgM2 - rounded) < 0.05) {
      recent.emission_ges_5_usages_par_m2_eq = String(rounded);
    } else {
      const { min, max } = buildEmissionRange(property.gesEmissionKgM2);
      recent.emission_ges_5_usages_par_m2_gte = String(min);
      recent.emission_ges_5_usages_par_m2_lte = String(max);
    }
  }

  if (property.surface) {
    const { min, max } = buildSurfaceRange(property.surface);
    recent.surface_habitable_logement_gte = String(min);
    recent.surface_habitable_logement_lte = String(max);
    legacy.surface_thermique_lot_gte = String(min);
    legacy.surface_thermique_lot_lte = String(max);
  }

  return { recent, legacy };
}

export function buildAdemeSearchParamVariants(
  property: PropertyRow
): AdemeSearchParams[] {
  const params = buildAdemeSearchParams(property);
  return params ? [params] : [];
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
  };

  addText(property.city);
  if (property.title) addText(property.title);

  if (property.description) {
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

function surfaceWithinMargin(
  propertySurface: number,
  candidateSurface: number | null,
  marginRatio = SURFACE_MARGIN_RATIO
): boolean {
  if (candidateSurface === null) return false;
  const { min, max } = buildSurfaceRange(propertySurface, marginRatio);
  return candidateSurface >= min && candidateSurface <= max;
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

  if (
    property.surface &&
    !surfaceWithinMargin(property.surface, candidate.surfaceM2)
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
    const margin = property.surface * SURFACE_MARGIN_RATIO || 1;
    score += Math.max(0, 20 * (1 - diff / margin));
  }

  score += scorePlaceHints(property, candidate.address);

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
