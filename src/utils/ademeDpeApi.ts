import type { PropertyRow } from "../types/listing.js";
import {
  buildDpeSearchQuery,
  rankDpeCandidates,
  type RankedDpeSearchResult,
} from "./dpePropertyMatch.js";

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets";

const DATASETS = {
  recent: "meg-83tjwtg8dyz4vv7h1dqe",
  legacy: "dpe-france",
} as const;

type DatasetKind = keyof typeof DATASETS;

export type DpeSearchResult = {
  numeroDpe: string;
  address: string;
  dpeClass: string | null;
  gesClass: string | null;
  surfaceM2: number | null;
  constructionYear: number | null;
  consumptionKwhM2Year: number | null;
  establishmentDate: string | null;
  expiryDate: string | null;
  buildingType: string | null;
  addressMatchScore: number | null;
  latitude: number | null;
  longitude: number | null;
  dataset: DatasetKind;
};

type RecentDpeLine = {
  numero_dpe?: string;
  adresse_ban?: string;
  adresse_complete_brut?: string;
  etiquette_dpe?: string;
  etiquette_ges?: string;
  surface_habitable_logement?: number;
  annee_construction?: number;
  conso_5_usages_par_m2_ep?: number;
  date_etablissement_dpe?: string;
  date_fin_validite_dpe?: string;
  type_batiment?: string;
  score_ban?: number;
  _geopoint?: string;
  _score?: number;
};

type LegacyDpeLine = {
  numero_dpe?: string;
  geo_adresse?: string;
  classe_consommation_energie?: string;
  classe_estimation_ges?: string;
  surface_thermique_lot?: number;
  annee_construction?: number;
  consommation_energie?: number;
  date_etablissement_dpe?: string;
  tr002_type_batiment_description?: string;
  geo_score?: number;
  latitude?: number;
  longitude?: number;
  _score?: number;
};

type DpeApiResponse<T> = {
  results?: T[];
};

function parseGeopoint(
  geopoint?: string
): { lat: number; lng: number } | null {
  if (!geopoint) return null;

  const [lat, lng] = geopoint.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function mapRecentLine(line: RecentDpeLine): DpeSearchResult | null {
  if (!line.numero_dpe) return null;

  const coords = parseGeopoint(line._geopoint);

  return {
    numeroDpe: line.numero_dpe,
    address:
      line.adresse_ban ?? line.adresse_complete_brut ?? "Adresse inconnue",
    dpeClass: line.etiquette_dpe ?? null,
    gesClass: line.etiquette_ges ?? null,
    surfaceM2: line.surface_habitable_logement ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.conso_5_usages_par_m2_ep ?? null,
    establishmentDate: line.date_etablissement_dpe ?? null,
    expiryDate: line.date_fin_validite_dpe ?? null,
    buildingType: line.type_batiment ?? null,
    addressMatchScore: line.score_ban ?? line._score ?? null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    dataset: "recent",
  };
}

function mapLegacyLine(line: LegacyDpeLine): DpeSearchResult | null {
  if (!line.numero_dpe) return null;

  return {
    numeroDpe: line.numero_dpe,
    address: line.geo_adresse ?? "Adresse inconnue",
    dpeClass: line.classe_consommation_energie ?? null,
    gesClass: line.classe_estimation_ges ?? null,
    surfaceM2: line.surface_thermique_lot ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.consommation_energie ?? null,
    establishmentDate: line.date_etablissement_dpe ?? null,
    expiryDate: null,
    buildingType: line.tr002_type_batiment_description ?? null,
    addressMatchScore: line.geo_score ?? line._score ?? null,
    latitude: line.latitude ?? null,
    longitude: line.longitude ?? null,
    dataset: "legacy",
  };
}

async function fetchDataset<T>(
  datasetId: string,
  query: string,
  limit: number
): Promise<T[]> {
  const url = new URL(`${BASE_URL}/${datasetId}/lines`);
  url.searchParams.set("q", query);
  url.searchParams.set("size", String(limit));

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `ADEME API error (${String(response.status)}): ${response.statusText}`
    );
  }

  const data = (await response.json()) as DpeApiResponse<T>;
  return data.results ?? [];
}

function compareResults(a: DpeSearchResult, b: DpeSearchResult): number {
  const scoreA = a.addressMatchScore ?? -1;
  const scoreB = b.addressMatchScore ?? -1;
  if (scoreB !== scoreA) return scoreB - scoreA;

  const dateA = a.establishmentDate
    ? Date.parse(a.establishmentDate)
    : Number.NEGATIVE_INFINITY;
  const dateB = b.establishmentDate
    ? Date.parse(b.establishmentDate)
    : Number.NEGATIVE_INFINITY;
  return dateB - dateA;
}

function dedupeResults(results: DpeSearchResult[]): DpeSearchResult[] {
  const byNumero = new Map<string, DpeSearchResult>();

  for (const result of results) {
    const existing = byNumero.get(result.numeroDpe);
    if (!existing || compareResults(result, existing) < 0) {
      byNumero.set(result.numeroDpe, result);
    }
  }

  return [...byNumero.values()];
}

async function searchDpeByQuery(
  query: string,
  limit = 5
): Promise<DpeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const perDataset = Math.max(limit, 10);

  const [recentLines, legacyLines] = await Promise.all([
    fetchDataset<RecentDpeLine>(DATASETS.recent, trimmed, perDataset),
    fetchDataset<LegacyDpeLine>(DATASETS.legacy, trimmed, perDataset),
  ]);

  const results = [
    ...recentLines.map(mapRecentLine),
    ...legacyLines.map(mapLegacyLine),
  ].filter((result): result is DpeSearchResult => result !== null);

  return dedupeResults(results).sort(compareResults).slice(0, limit);
}

export async function searchDpeForProperty(
  property: PropertyRow,
  limit = 5
): Promise<{ query: string; candidates: RankedDpeSearchResult[] }> {
  const query = buildDpeSearchQuery(property);
  const raw = await searchDpeByQuery(query, 25);
  return {
    query,
    candidates: rankDpeCandidates(property, raw, limit),
  };
}

export async function fetchDpeByNumero(
  numeroDpe: string
): Promise<DpeSearchResult | null> {
  const query = numeroDpe.trim();
  if (!query) return null;

  const [recentLines, legacyLines] = await Promise.all([
    fetchDataset<RecentDpeLine>(DATASETS.recent, query, 3),
    fetchDataset<LegacyDpeLine>(DATASETS.legacy, query, 3),
  ]);

  const results = [
    ...recentLines.map(mapRecentLine),
    ...legacyLines.map(mapLegacyLine),
  ].filter((result): result is DpeSearchResult => result !== null);

  return (
    results.find(
      (result) => result.numeroDpe.toUpperCase() === query.toUpperCase()
    ) ?? null
  );
}
