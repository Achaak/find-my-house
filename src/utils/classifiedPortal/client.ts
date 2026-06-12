import { HTTPError, httpClient } from "../http/client.js";
import { wrapHttpError } from "../errors/httpError.js";
import { ClassifiedPortalAccessBlockedError } from "./errors.js";
import { getClassifiedPortalHeaders } from "./headers.js";
import { parseClassifiedDetailPage } from "./parsers/detailPage.js";
import { parseClassifiedSearchHtml } from "./parsers/searchHtml.js";
import type { ClassifiedCard, ClassifiedPortalConfig } from "./types.js";

/** Minimum delay between search page fetches (anti-bot). */
export const SEARCH_PAGE_DELAY_MS = 800;
/** Minimum delay between detail page fetches (anti-bot). */
export const DETAIL_FETCH_DELAY_MS = 400;
const SEARCH_PARSE_MAX_ATTEMPTS = 3;
const SEARCH_PARSE_RETRY_DELAY_MS = 3_000;

const searchFetchState = new Map<ClassifiedPortalConfig["id"], number>();
const detailFetchState = new Map<ClassifiedPortalConfig["id"], number>();

function isClassifiedSearchParseError(
  portal: ClassifiedPortalConfig,
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(
      `${portal.label}: données de recherche introuvables`
    )
  );
}

async function fetchAndParseClassifiedSearchPage(
  portal: ClassifiedPortalConfig,
  url: string
): Promise<ReturnType<typeof parseClassifiedSearchHtml>> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= SEARCH_PARSE_MAX_ATTEMPTS; attempt++) {
    const html = await fetchClassifiedSearchPage(portal, url);
    try {
      return parseClassifiedSearchHtml(portal, html);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (
        attempt < SEARCH_PARSE_MAX_ATTEMPTS &&
        isClassifiedSearchParseError(portal, error)
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, SEARCH_PARSE_RETRY_DELAY_MS * attempt)
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error(`${portal.label}: échec de parsing recherche`);
}

async function fetchClassifiedSearchPage(
  portal: ClassifiedPortalConfig,
  url: string
): Promise<string> {
  const now = Date.now();
  const lastFetchAt = searchFetchState.get(portal.id) ?? 0;
  const wait = Math.max(0, lastFetchAt + SEARCH_PAGE_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  searchFetchState.set(portal.id, Date.now());

  try {
    return await httpClient(url, {
      headers: getClassifiedPortalHeaders(portal, "html", {
        Referer: `${portal.baseUrl}/`,
      }),
    }).text();
  } catch (error) {
    if (error instanceof HTTPError && error.response.statusCode === 403) {
      throw new ClassifiedPortalAccessBlockedError(portal);
    }
    wrapHttpError(portal.label, error);
  }
}

async function fetchClassifiedDetailHtml(
  portal: ClassifiedPortalConfig,
  url: string
): Promise<string> {
  const now = Date.now();
  const lastFetchAt = detailFetchState.get(portal.id) ?? 0;
  const wait = Math.max(0, lastFetchAt + DETAIL_FETCH_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  detailFetchState.set(portal.id, Date.now());

  try {
    return await httpClient(url, {
      headers: getClassifiedPortalHeaders(portal, "html", {
        Referer: `${portal.baseUrl}/classified-search`,
        "Sec-Fetch-Site": "same-origin",
      }),
    }).text();
  } catch (error) {
    if (error instanceof HTTPError && error.response.statusCode === 403) {
      throw new ClassifiedPortalAccessBlockedError(portal);
    }
    wrapHttpError(portal.label, error);
  }
}

export async function fetchClassifiedCards(
  portal: ClassifiedPortalConfig,
  searchUrl: string,
  maxPages = Number.POSITIVE_INFINITY
): Promise<ClassifiedCard[]> {
  const firstPage = await fetchAndParseClassifiedSearchPage(portal, searchUrl);
  const allCards = [...firstPage.cards];

  if (maxPages <= 1) return allCards;

  const totalPages = Math.min(
    maxPages,
    Math.ceil(firstPage.totalCount / firstPage.resultsPerPage)
  );

  const baseUrl = new URL(searchUrl);
  baseUrl.searchParams.delete("page");

  for (let page = 2; page <= totalPages; page++) {
    baseUrl.searchParams.set("page", String(page));
    const pageData = await fetchAndParseClassifiedSearchPage(
      portal,
      baseUrl.toString()
    );
    if (!pageData.cards.length) break;
    allCards.push(...pageData.cards);
  }

  return allCards;
}

export async function fetchClassifiedListingDetails(
  portal: ClassifiedPortalConfig,
  url: string
): Promise<ReturnType<typeof parseClassifiedDetailPage>> {
  const html = await fetchClassifiedDetailHtml(portal, url);
  return parseClassifiedDetailPage(html);
}
