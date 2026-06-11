import got, { HTTPError } from "got";
import type { PropertyRow } from "../types/listing.js";
import {
  buildAdemeSearchParamVariants,
  formatDpeSearchCriteria,
  rankDpeCandidates,
  type AdemeSearchParams,
  type RankedDpeSearchResult,
} from "./dpePropertyMatch.js";

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets";

const ADEME_CLIENT = got.extend({
  headers: { Accept: "application/json" },
  retry: {
    limit: 3,
    methods: ["GET"],
    statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
    errorCodes: [
      "ETIMEDOUT",
      "ECONNRESET",
      "EAI_AGAIN",
      "ENOTFOUND",
      "ECONNREFUSED",
      "UND_ERR_SOCKET",
      "UND_ERR_CONNECT_TIMEOUT",
    ],
    calculateDelay: ({ attemptCount }) => 1_000 * 2 ** (attemptCount - 1),
  },
  timeout: { request: 45_000 },
});

const DATASETS = {
  recent: "meg-83tjwtg8dyz4vv7h1dqe",
  legacy: "dpe-france",
} as const;

const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_TOTAL = 500;

type DatasetKind = keyof typeof DATASETS;

export type DpeSearchResult = {
  numeroDpe: string;
  address: string;
  postalCode: string | null;
  departmentCode: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  surfaceM2: number | null;
  constructionYear: number | null;
  consumptionKwhM2Year: number | null;
  emissionGesKgM2Year: number | null;
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
  code_postal_ban?: string;
  code_departement_ban?: string;
  etiquette_dpe?: string;
  etiquette_ges?: string;
  surface_habitable_logement?: number;
  annee_construction?: number;
  conso_5_usages_par_m2_ep?: number;
  emission_ges_5_usages_par_m2?: number;
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
  tv016_departement_code?: string;
  _score?: number;
};

type DpeApiResponse<T> = {
  results?: T[];
  next?: string;
  total?: number;
};

function parseGeopoint(geopoint?: string): { lat: number; lng: number } | null {
  if (!geopoint) return null;

  const [lat, lng] = geopoint.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

function extractPostalCodeFromAddress(address: string): string | null {
  const match = /\b(\d{5})\b/.exec(address);
  return match?.[1] ?? null;
}

function mapRecentLine(line: RecentDpeLine): DpeSearchResult | null {
  if (!line.numero_dpe) return null;

  const coords = parseGeopoint(line._geopoint);
  const address =
    line.adresse_ban ?? line.adresse_complete_brut ?? "Adresse inconnue";

  return {
    numeroDpe: line.numero_dpe,
    address,
    postalCode: line.code_postal_ban ?? extractPostalCodeFromAddress(address),
    departmentCode: line.code_departement_ban ?? null,
    dpeClass: line.etiquette_dpe ?? null,
    gesClass: line.etiquette_ges ?? null,
    surfaceM2: line.surface_habitable_logement ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.conso_5_usages_par_m2_ep ?? null,
    emissionGesKgM2Year: line.emission_ges_5_usages_par_m2 ?? null,
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

  const address = line.geo_adresse ?? "Adresse inconnue";

  return {
    numeroDpe: line.numero_dpe,
    address,
    postalCode: extractPostalCodeFromAddress(address),
    departmentCode: line.tv016_departement_code ?? null,
    dpeClass: line.classe_consommation_energie ?? null,
    gesClass: line.classe_estimation_ges ?? null,
    surfaceM2: line.surface_thermique_lot ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.consommation_energie ?? null,
    emissionGesKgM2Year: null,
    establishmentDate: line.date_etablissement_dpe ?? null,
    expiryDate: null,
    buildingType: line.tr002_type_batiment_description ?? null,
    addressMatchScore: line.geo_score ?? line._score ?? null,
    latitude: line.latitude ?? null,
    longitude: line.longitude ?? null,
    dataset: "legacy",
  };
}

async function fetchDatasetAll<T>(
  datasetId: string,
  params: Record<string, string>
): Promise<T[] | null> {
  const initialUrl = new URL(`${BASE_URL}/${datasetId}/lines`);
  initialUrl.searchParams.set("size", String(FETCH_PAGE_SIZE));
  for (const [key, value] of Object.entries(params)) {
    initialUrl.searchParams.set(key, value);
  }

  const all: T[] = [];
  let url: string | null = initialUrl.toString();

  try {
    while (url && all.length < MAX_FETCH_TOTAL) {
      const data: DpeApiResponse<T> = await ADEME_CLIENT.get(url).json();
      all.push(...(data.results ?? []));
      if (!data.next || (data.results?.length ?? 0) === 0) break;
      url = data.next;
    }
    return all;
  } catch (error) {
    const status =
      error instanceof HTTPError
        ? String(error.response.statusCode)
        : "network";
    console.warn(
      `[ademe] Requête échouée (${status}) sur ${datasetId}:`,
      initialUrl.search
    );
    return all.length > 0 ? all : null;
  }
}

async function fetchBothDatasets(
  params: AdemeSearchParams
): Promise<{ recentLines: RecentDpeLine[]; legacyLines: LegacyDpeLine[] }> {
  const recentLines = await fetchDatasetAll<RecentDpeLine>(
    DATASETS.recent,
    params.recent
  );
  const legacyLines = await fetchDatasetAll<LegacyDpeLine>(
    DATASETS.legacy,
    params.legacy
  );

  return {
    recentLines: recentLines ?? [],
    legacyLines: legacyLines ?? [],
  };
}

function compareResults(a: DpeSearchResult, b: DpeSearchResult): number {
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
    if (!existing || compareResults(result, existing) > 0) {
      byNumero.set(result.numeroDpe, result);
    }
  }

  return [...byNumero.values()];
}

function mapDatasetResults(
  recentLines: RecentDpeLine[],
  legacyLines: LegacyDpeLine[]
): DpeSearchResult[] {
  return [
    ...recentLines.map(mapRecentLine),
    ...legacyLines.map(mapLegacyLine),
  ].filter((result): result is DpeSearchResult => result !== null);
}

async function searchDpeWithParams(
  params: AdemeSearchParams
): Promise<DpeSearchResult[]> {
  const { recentLines, legacyLines } = await fetchBothDatasets(params);

  if (recentLines.length === 0 && legacyLines.length === 0) {
    return [];
  }

  return dedupeResults(mapDatasetResults(recentLines, legacyLines));
}

export async function searchDpeForProperty(
  property: PropertyRow,
  limit = 5
): Promise<{ query: string; candidates: RankedDpeSearchResult[] }> {
  const query = formatDpeSearchCriteria(property);
  const variants = buildAdemeSearchParamVariants(property);

  if (variants.length === 0) {
    return { query, candidates: [] };
  }

  const rawByNumero = new Map<string, DpeSearchResult>();

  for (const params of variants) {
    const batch = await searchDpeWithParams(params);
    for (const result of batch) {
      const existing = rawByNumero.get(result.numeroDpe);
      if (!existing || compareResults(result, existing) > 0) {
        rawByNumero.set(result.numeroDpe, result);
      }
    }

    const candidates = rankDpeCandidates(
      property,
      [...rawByNumero.values()],
      limit
    );
    if (candidates.length > 0) {
      return { query, candidates };
    }
  }

  return {
    query,
    candidates: rankDpeCandidates(property, [...rawByNumero.values()], limit),
  };
}

async function fetchDatasetPage<T>(
  datasetId: string,
  params: Record<string, string>,
  limit: number
): Promise<T[]> {
  const url = new URL(`${BASE_URL}/${datasetId}/lines`);
  url.searchParams.set("size", String(limit));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const data = await ADEME_CLIENT.get(url.toString()).json<
      DpeApiResponse<T>
    >();
    return data.results ?? [];
  } catch (error) {
    console.warn(
      `[ademe] Échec requête dataset ${datasetId}:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}

export async function fetchDpeByNumero(
  numeroDpe: string
): Promise<DpeSearchResult | null> {
  const query = numeroDpe.trim();
  if (!query) return null;

  const searchParams = { q: query };
  const [recentLines, legacyLines] = await Promise.all([
    fetchDatasetPage<RecentDpeLine>(DATASETS.recent, searchParams, 5),
    fetchDatasetPage<LegacyDpeLine>(DATASETS.legacy, searchParams, 5),
  ]);

  const results = mapDatasetResults(recentLines, legacyLines);

  return (
    results.find(
      (result) => result.numeroDpe.toUpperCase() === query.toUpperCase()
    ) ?? null
  );
}
