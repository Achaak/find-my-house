import { HTTPError, httpClient } from "../http/client.js";
import { wrapHttpError } from "../errors/httpError.js";
import { SeLogerAccessBlockedError } from "./errors.js";
import { getSeLogerHeaders } from "./headers.js";
import { parseSeLogerDetailPage } from "./parsers/detailPage.js";
import { parseSeLogerSearchHtml } from "./parsers/searchHtml.js";
import { BASE_URL, type SeLogerClassifiedCard } from "./types.js";

/** Minimum delay between search page fetches (anti-bot). */
export const SEARCH_PAGE_DELAY_MS = 800;
/** Minimum delay between detail page fetches (anti-bot). */
export const DETAIL_FETCH_DELAY_MS = 400;
/** Retries when the search page returns HTML without embedded JSON (transient blocks). */
const SEARCH_PARSE_MAX_ATTEMPTS = 3;
const SEARCH_PARSE_RETRY_DELAY_MS = 3_000;

let lastSearchFetchAt = 0;
let lastDetailFetchAt = 0;

function isSeLogerSearchParseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith("SeLoger: données de recherche introuvables")
  );
}

async function fetchAndParseSeLogerSearchPage(
  url: string
): Promise<ReturnType<typeof parseSeLogerSearchHtml>> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= SEARCH_PARSE_MAX_ATTEMPTS; attempt++) {
    const html = await fetchSeLogerSearchPage(url);
    try {
      return parseSeLogerSearchHtml(html);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (
        attempt < SEARCH_PARSE_MAX_ATTEMPTS &&
        isSeLogerSearchParseError(error)
      ) {
        await new Promise((resolve) =>
          setTimeout(resolve, SEARCH_PARSE_RETRY_DELAY_MS * attempt)
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("SeLoger: échec de parsing recherche");
}

async function fetchSeLogerSearchPage(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, lastSearchFetchAt + SEARCH_PAGE_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastSearchFetchAt = Date.now();

  try {
    return await httpClient(url, {
      headers: getSeLogerHeaders("html", { Referer: `${BASE_URL}/` }),
    }).text();
  } catch (error) {
    if (error instanceof HTTPError && error.response.statusCode === 403) {
      throw new SeLogerAccessBlockedError();
    }
    wrapHttpError("SeLoger", error);
  }
}

async function fetchSeLogerDetailHtml(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, lastDetailFetchAt + DETAIL_FETCH_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastDetailFetchAt = Date.now();

  try {
    return await httpClient(url, {
      headers: getSeLogerHeaders("html", {
        Referer: `${BASE_URL}/classified-search`,
        "Sec-Fetch-Site": "same-origin",
      }),
    }).text();
  } catch (error) {
    if (error instanceof HTTPError && error.response.statusCode === 403) {
      throw new SeLogerAccessBlockedError();
    }
    wrapHttpError("SeLoger", error);
  }
}

export async function fetchSeLogerClassifieds(
  searchUrl: string,
  maxPages = Number.POSITIVE_INFINITY
): Promise<SeLogerClassifiedCard[]> {
  const firstPage = await fetchAndParseSeLogerSearchPage(searchUrl);
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
    const pageData = await fetchAndParseSeLogerSearchPage(baseUrl.toString());
    if (!pageData.cards.length) break;
    allCards.push(...pageData.cards);
  }

  return allCards;
}

export async function fetchSeLogerListingDetails(
  url: string
): Promise<ReturnType<typeof parseSeLogerDetailPage>> {
  const html = await fetchSeLogerDetailHtml(url);
  return parseSeLogerDetailPage(html);
}
