import type { PropertyRow } from "../../types/listing.js";
import { createLogger } from "../logger.js";
import { HTTPError, ademeHttpClient } from "../http/client.js";
import {
  mapDatasetResults,
  type DpeSearchResult,
  type LegacyDpeLine,
  type RecentDpeLine,
} from "./ademeDpeMappers.js";
import {
  buildAdemeSearchParamVariants,
  formatDpeSearchCriteria,
  rankDpeCandidates,
  type AdemeSearchParams,
  type RankedDpeSearchResult,
} from "./dpePropertyMatch.js";

export type { DpeSearchResult } from "./ademeDpeMappers.js";

const log = createLogger("ademe");

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets";

const DATASETS = {
  recent: "meg-83tjwtg8dyz4vv7h1dqe",
  legacy: "dpe-france",
} as const;

const FETCH_PAGE_SIZE = 100;
const MAX_FETCH_TOTAL = 500;

type DpeApiResponse<T> = {
  results?: T[];
  next?: string;
  total?: number;
};

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
      const data: DpeApiResponse<T> = await ademeHttpClient.get(url).json();
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
    log.warn(`Request failed (${status}) on ${datasetId}:`, initialUrl.search);
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
    const data = await ademeHttpClient
      .get(url.toString())
      .json<DpeApiResponse<T>>();
    return data.results ?? [];
  } catch (error) {
    log.warn(
      `Dataset request failed ${datasetId}:`,
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
