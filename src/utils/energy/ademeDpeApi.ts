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
  getDpeAddressSearchReadiness,
  rankDpeCandidates,
  type AdemeSearchParams,
  type AdemeSearchVariant,
  type DpeAddressSearchReadiness,
  type RankedDpeSearchResult,
} from "./dpePropertyMatch.js";

export type { DpeSearchResult } from "./ademeDpeMappers.js";

const log = createLogger("ademe");

const BASE_URL = "https://data.ademe.fr/data-fair/api/v1/datasets";

const DATASETS = {
  recent: "meg-83tjwtg8dyz4vv7h1dqe",
  legacy: "dpe-france",
} as const;

export const ADEME_FETCH_PAGE_SIZE = 100;
export const ADEME_MAX_FETCH_TOTAL = 500;

type DpeApiResponse<T> = {
  results?: T[];
  next?: string;
  total?: number;
};

type FetchDatasetResult<T> = {
  lines: T[];
  total: number | null;
  truncated: boolean;
};

async function fetchDatasetAll<T>(
  datasetId: string,
  params: Record<string, string>
): Promise<FetchDatasetResult<T>> {
  const initialUrl = new URL(`${BASE_URL}/${datasetId}/lines`);
  initialUrl.searchParams.set("size", String(ADEME_FETCH_PAGE_SIZE));
  for (const [key, value] of Object.entries(params)) {
    initialUrl.searchParams.set(key, value);
  }

  const lines: T[] = [];
  let url: string | null = initialUrl.toString();
  let total: number | null = null;

  try {
    while (url && lines.length < ADEME_MAX_FETCH_TOTAL) {
      const data: DpeApiResponse<T> = await ademeHttpClient.get(url).json();
      if (total === null && data.total !== undefined) {
        total = data.total;
      }
      lines.push(...(data.results ?? []));
      if (!data.next || (data.results?.length ?? 0) === 0) break;
      url = data.next;
    }
  } catch (error) {
    const status =
      error instanceof HTTPError
        ? String(error.response.statusCode)
        : "network";
    log.warn(`Request failed (${status}) on ${datasetId}:`, initialUrl.search);
  }

  const truncated =
    total !== null
      ? total > lines.length
      : lines.length >= ADEME_MAX_FETCH_TOTAL;

  return { lines, total, truncated };
}

type DatasetFetchSummary = {
  recentLines: RecentDpeLine[];
  legacyLines: LegacyDpeLine[];
  truncated: boolean;
  total: number | null;
};

async function fetchBothDatasets(
  params: AdemeSearchParams
): Promise<DatasetFetchSummary> {
  const [recent, legacy] = await Promise.all([
    fetchDatasetAll<RecentDpeLine>(DATASETS.recent, params.recent),
    fetchDatasetAll<LegacyDpeLine>(DATASETS.legacy, params.legacy),
  ]);

  const total =
    recent.total !== null || legacy.total !== null
      ? (recent.total ?? 0) + (legacy.total ?? 0)
      : null;

  return {
    recentLines: recent.lines,
    legacyLines: legacy.lines,
    truncated: recent.truncated || legacy.truncated,
    total,
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

function mergeResults(
  target: Map<string, DpeSearchResult>,
  batch: DpeSearchResult[]
): void {
  for (const result of batch) {
    const existing = target.get(result.numeroDpe);
    if (!existing || compareResults(result, existing) > 0) {
      target.set(result.numeroDpe, result);
    }
  }
}

async function searchDpeWithParams(params: AdemeSearchParams): Promise<{
  results: DpeSearchResult[];
  truncated: boolean;
  total: number | null;
}> {
  const { recentLines, legacyLines, truncated, total } =
    await fetchBothDatasets(params);

  if (recentLines.length === 0 && legacyLines.length === 0) {
    return { results: [], truncated, total };
  }

  return {
    results: dedupeResults(mapDatasetResults(recentLines, legacyLines)),
    truncated,
    total,
  };
}

function shouldRetryWithSurfaceVariant(
  variant: AdemeSearchVariant,
  truncated: boolean,
  property: PropertyRow
): boolean {
  return (
    truncated &&
    !variant.includeSurfaceFilter &&
    property.surface !== null &&
    variant.id !== "degraded_surface" &&
    variant.id !== "relaxed_surface"
  );
}

function surfaceFallbackVariant(
  variants: AdemeSearchVariant[],
  current: AdemeSearchVariant
): AdemeSearchVariant | undefined {
  if (current.id.startsWith("degraded")) {
    return variants.find((variant) => variant.id === "degraded_surface");
  }
  return variants.find((variant) => variant.id === "relaxed_surface");
}

export type DpePropertySearchResult = {
  query: string;
  candidates: RankedDpeSearchResult[];
  readiness: DpeAddressSearchReadiness;
  warnings: string[];
};

export async function searchDpeForProperty(
  property: PropertyRow,
  limit = 5
): Promise<DpePropertySearchResult> {
  const query = formatDpeSearchCriteria(property);
  const readiness = getDpeAddressSearchReadiness(property);
  const warnings: string[] = [];

  if (readiness === "unavailable") {
    return { query, candidates: [], readiness, warnings };
  }

  if (readiness === "degraded") {
    warnings.push(
      "DPE letter only (no kWh/m² or kg CO₂/m²) — results may be incomplete."
    );
  }

  const variants = buildAdemeSearchParamVariants(property);
  if (variants.length === 0) {
    return { query, candidates: [], readiness, warnings };
  }

  const rawByNumero = new Map<string, DpeSearchResult>();
  let truncated = false;
  let totalResults: number | null = null;

  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    const {
      results,
      truncated: batchTruncated,
      total,
    } = await searchDpeWithParams(variant.params);

    truncated ||= batchTruncated;
    if (total !== null) {
      totalResults =
        totalResults === null ? total : Math.max(totalResults, total);
    }

    mergeResults(rawByNumero, results);

    if (shouldRetryWithSurfaceVariant(variant, batchTruncated, property)) {
      const fallback = surfaceFallbackVariant(variants, variant);
      if (
        fallback &&
        !variants.slice(0, index + 1).some((v) => v.id === fallback.id)
      ) {
        variants.splice(index + 1, 0, fallback);
      }
    }

    const candidates = rankDpeCandidates(
      property,
      [...rawByNumero.values()],
      limit
    );
    if (candidates.length > 0) {
      if (truncated) {
        warnings.push(
          `ADEME returned more matches than fetched (analyzed ${String(ADEME_MAX_FETCH_TOTAL)} max per dataset${totalResults !== null ? `, ${String(totalResults)}+ total` : ""}).`
        );
      }
      return { query, candidates, readiness, warnings };
    }
  }

  if (truncated) {
    warnings.push(
      `ADEME returned more matches than fetched (analyzed ${String(ADEME_MAX_FETCH_TOTAL)} max per dataset${totalResults !== null ? `, ${String(totalResults)}+ total` : ""}).`
    );
  }

  return {
    query,
    candidates: rankDpeCandidates(property, [...rawByNumero.values()], limit),
    readiness,
    warnings,
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
