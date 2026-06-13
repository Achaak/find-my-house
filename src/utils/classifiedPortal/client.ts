import {
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
} from "../browser/delays.js";
import {
  clearBrowserCookiesForHost,
  fetchPageHtml,
  isBrowserAccessBlocked,
  isRetryableBrowserFetchError,
  resetBrowserProfile,
  warmUpBrowserSession,
} from "../browser/client.js";
import { wrapHttpError } from "../errors/httpError.js";
import { ClassifiedPortalAccessBlockedError } from "./errors.js";
import { parseClassifiedDetailPage } from "./parsers/detailPage.js";
import {
  isEmptyClassifiedSearchShell,
  isIncompleteClassifiedSearchHtml,
} from "./parsers/htmlDiagnostics.js";
import { parseClassifiedSearchHtml } from "./parsers/searchHtml.js";
import { buildClassifiedSeoSearchUrl } from "./place.js";
import {
  classifiedSearchResultsPerPage,
  fetchClassifiedSearchViaSerpBff,
  filterClassifiedCardsByPostalCode,
  filterClassifiedCardsBySearchUrl,
  isCityOnlyClassifiedSearchUrl,
} from "./searchApi.js";
import type {
  ClassifiedCard,
  ClassifiedPlace,
  ClassifiedPortalConfig,
} from "./types.js";

export { DETAIL_FETCH_DELAY_MS, SEARCH_PAGE_DELAY_MS };
/** Search pages can exceed 1 MB — allow more time on slow links (e.g. Home Assistant). */
const SEARCH_REQUEST_TIMEOUT_MS = 60_000;
const SEARCH_HTML_SETTLE_MS = 5_000;
const SEARCH_PARSE_MAX_ATTEMPTS = 4;
const SEARCH_PARSE_RETRY_DELAY_MS = 4_000;

export type FetchClassifiedCardsOptions = {
  place?: ClassifiedPlace;
  postalCode?: string;
};

type ParsedSearchPage = ReturnType<typeof parseClassifiedSearchHtml> & {
  viaSeoFallback?: boolean;
};

const searchFetchState = new Map<ClassifiedPortalConfig["id"], number>();
const detailFetchState = new Map<ClassifiedPortalConfig["id"], number>();

function isClassifiedSearchParseError(
  portal: ClassifiedPortalConfig,
  error: unknown
): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(`${portal.label}: search data not found`)
  );
}

function handleFetchError(
  portal: ClassifiedPortalConfig,
  error: unknown
): never {
  if (isBrowserAccessBlocked(error)) {
    throw new ClassifiedPortalAccessBlockedError(portal, error.statusCode);
  }
  wrapHttpError(portal.label, error);
}

async function clearPortalSession(
  portal: ClassifiedPortalConfig
): Promise<void> {
  await clearBrowserCookiesForHost(new URL(portal.baseUrl).hostname);
}

function applySearchFilters(
  result: ParsedSearchPage,
  filterUrl: string,
  postalCode?: string
): ParsedSearchPage {
  // classified-search applies criteria server-side; re-filtering card previews
  // drops valid listings (incomplete fields) and breaks pagination via totalCount.
  let cards = result.viaSeoFallback
    ? filterClassifiedCardsBySearchUrl(result.cards, filterUrl)
    : result.cards;

  if (postalCode && isCityOnlyClassifiedSearchUrl(filterUrl)) {
    cards = filterClassifiedCardsByPostalCode(cards, postalCode);
  }

  return { ...result, cards };
}

function searchPageFromUrl(url: string): number {
  const parsed = new URL(url);
  const listingPage = parsed.searchParams.get("LISTING-LISTpg");
  if (listingPage) return Math.max(1, Number(listingPage) || 1);
  return Math.max(1, Number(parsed.searchParams.get("page") ?? "1") || 1);
}

async function fetchClassifiedSearchPageHtml(
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

  return fetchPageHtml(url, {
    referer: `${portal.baseUrl}/`,
    timeoutMs: SEARCH_REQUEST_TIMEOUT_MS,
    waitUntil: "networkidle",
    settleMs: SEARCH_HTML_SETTLE_MS,
  });
}

async function recoverFromBlockedFetch(
  portal: ClassifiedPortalConfig,
  attempt: number
): Promise<void> {
  await clearPortalSession(portal);
  if (attempt >= 2) {
    await resetBrowserProfile();
  }
  await new Promise((resolve) =>
    setTimeout(resolve, SEARCH_PARSE_RETRY_DELAY_MS * attempt)
  );
}

async function fetchClassifiedSearchViaSeoFallback(
  portal: ClassifiedPortalConfig,
  options: FetchClassifiedCardsOptions,
  filterUrl: string,
  page: number
): Promise<ParsedSearchPage | null> {
  if (portal.id !== "seloger" || !options.place) return null;

  const seoUrl = buildClassifiedSeoSearchUrl(portal, options.place, page);
  const html = await fetchClassifiedSearchPageHtml(portal, seoUrl);

  try {
    const parsed = parseClassifiedSearchHtml(portal, html);
    if (!parsed.cards.length) return null;
    return {
      ...applySearchFilters(parsed, filterUrl, options.postalCode),
      viaSeoFallback: true,
    };
  } catch {
    return null;
  }
}

async function fetchAndParseClassifiedSearchPage(
  portal: ClassifiedPortalConfig,
  fetchUrl: string,
  options: FetchClassifiedCardsOptions = {},
  filterUrl = fetchUrl
): Promise<ParsedSearchPage> {
  const page = searchPageFromUrl(fetchUrl);
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= SEARCH_PARSE_MAX_ATTEMPTS; attempt++) {
    await warmUpBrowserSession(portal.baseUrl);

    if (portal.id === "seloger" && fetchUrl.includes("classified-search")) {
      try {
        const apiResult = await fetchClassifiedSearchViaSerpBff(
          portal,
          fetchUrl
        );
        if (apiResult?.cards.length) {
          return applySearchFilters(apiResult, filterUrl, options.postalCode);
        }
      } catch {
        /* serp-bff is best-effort — HTML search is the primary path */
      }
    }

    let html: string;
    try {
      html = await fetchClassifiedSearchPageHtml(portal, fetchUrl);
    } catch (error) {
      if (
        isRetryableBrowserFetchError(error) &&
        attempt < SEARCH_PARSE_MAX_ATTEMPTS
      ) {
        await recoverFromBlockedFetch(portal, attempt);
        continue;
      }
      handleFetchError(portal, error);
    }

    if (
      isIncompleteClassifiedSearchHtml(html) &&
      attempt < SEARCH_PARSE_MAX_ATTEMPTS
    ) {
      await clearPortalSession(portal);
      await new Promise((resolve) =>
        setTimeout(resolve, SEARCH_PARSE_RETRY_DELAY_MS * attempt)
      );
      continue;
    }

    if (
      isEmptyClassifiedSearchShell(html) &&
      options.place &&
      fetchUrl.includes("classified-search") &&
      isCityOnlyClassifiedSearchUrl(filterUrl)
    ) {
      const seoResult = await fetchClassifiedSearchViaSeoFallback(
        portal,
        options,
        filterUrl,
        page
      );
      if (seoResult) return seoResult;
    }

    try {
      const parsed = parseClassifiedSearchHtml(portal, html);
      if (parsed.cards.length || !isEmptyClassifiedSearchShell(html)) {
        return applySearchFilters(parsed, filterUrl, options.postalCode);
      }

      if (
        options.place &&
        fetchUrl.includes("classified-search") &&
        isCityOnlyClassifiedSearchUrl(filterUrl)
      ) {
        const seoResult = await fetchClassifiedSearchViaSeoFallback(
          portal,
          options,
          filterUrl,
          page
        );
        if (seoResult) return seoResult;
      }

      return applySearchFilters(parsed, filterUrl, options.postalCode);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (
        attempt < SEARCH_PARSE_MAX_ATTEMPTS &&
        isClassifiedSearchParseError(portal, error)
      ) {
        await clearPortalSession(portal);
        await new Promise((resolve) =>
          setTimeout(resolve, SEARCH_PARSE_RETRY_DELAY_MS * attempt)
        );
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error(`${portal.label}: search parse failed`);
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
    return await fetchPageHtml(url, {
      referer: `${portal.baseUrl}/classified-search`,
      timeoutMs: 30_000,
      waitUntil: "networkidle",
      settleMs: 2_000,
    });
  } catch (error) {
    handleFetchError(portal, error);
  }
}

export async function fetchClassifiedCards(
  portal: ClassifiedPortalConfig,
  searchUrl: string,
  maxPages = Number.POSITIVE_INFINITY,
  options: FetchClassifiedCardsOptions = {}
): Promise<ClassifiedCard[]> {
  const firstPage = await fetchAndParseClassifiedSearchPage(
    portal,
    searchUrl,
    options,
    searchUrl
  );
  const allCards = [...firstPage.cards];

  if (maxPages <= 1) return allCards;

  const resultsPerPage = classifiedSearchResultsPerPage(
    firstPage.resultsPerPage
  );
  const totalPages = Math.min(
    maxPages,
    Math.max(1, Math.ceil(firstPage.totalCount / resultsPerPage))
  );

  for (let page = 2; page <= totalPages; page++) {
    const pageFetchUrl =
      firstPage.viaSeoFallback && options.place
        ? buildClassifiedSeoSearchUrl(portal, options.place, page)
        : (() => {
            const baseUrl = new URL(searchUrl);
            baseUrl.searchParams.delete("page");
            baseUrl.searchParams.set("page", String(page));
            return baseUrl.toString();
          })();

    const pageData = await fetchAndParseClassifiedSearchPage(
      portal,
      pageFetchUrl,
      options,
      searchUrl
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
