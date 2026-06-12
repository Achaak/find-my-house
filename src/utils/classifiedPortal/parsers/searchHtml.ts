import type {
  ClassifiedCard,
  ClassifiedData,
  ClassifiedPortalConfig,
  ClassifiedSearchResponse,
  ClassifiedUfrnPageProps,
} from "../types.js";
import { CLASSIFIED_PAGE_SIZE } from "../types.js";
import { mapClassifiedDataToCard } from "./classifiedCard.js";
import { parseEmbeddedWindowJson } from "./embeddedJson.js";
import { describeClassifiedSearchHtmlFailure } from "./htmlDiagnostics.js";

function decodeInitialDataJson(encoded: string): ClassifiedSearchResponse {
  const decoded = encoded
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  return JSON.parse(decoded) as ClassifiedSearchResponse;
}

function extractClassifiedCards(
  data: ClassifiedSearchResponse
): ClassifiedCard[] {
  return (
    data.cards?.list?.filter((card) => card.cardType === "classified") ?? []
  );
}

function parseSearchResponse(data: ClassifiedSearchResponse): {
  cards: ClassifiedCard[];
  totalCount: number;
  resultsPerPage: number;
} {
  const cards = extractClassifiedCards(data);
  return {
    cards,
    totalCount: data.navigation?.counts?.count ?? cards.length,
    resultsPerPage:
      data.navigation?.pagination?.resultsPerPage ?? CLASSIFIED_PAGE_SIZE,
  };
}

function parseUfrnFetcherHtml(html: string): {
  cards: ClassifiedCard[];
  totalCount: number;
  resultsPerPage: number;
} | null {
  const fetcher = parseEmbeddedWindowJson("__UFRN_FETCHER__", html) as {
    data?: Record<string, { pageProps?: ClassifiedUfrnPageProps }>;
  } | null;

  if (!fetcher?.data) return null;

  const pageProps = fetcher.data["classified-serp-init-data"].pageProps;
  if (!pageProps) return null;

  const classifiedsData = pageProps.classifiedsData ?? {};
  const cards = (pageProps.classifieds ?? [])
    .map((classifiedId) => classifiedsData[classifiedId])
    .filter((data): data is ClassifiedData => Boolean(data))
    .map(mapClassifiedDataToCard)
    .filter((card): card is ClassifiedCard => card !== null);

  const resultsPerPage = cards.length || CLASSIFIED_PAGE_SIZE;

  return {
    cards,
    totalCount: pageProps.totalCount ?? cards.length,
    resultsPerPage,
  };
}

export function parseClassifiedSearchHtml(
  portal: ClassifiedPortalConfig,
  html: string
): {
  cards: ClassifiedCard[];
  totalCount: number;
  resultsPerPage: number;
} {
  const initialDataMatch =
    /window\["initialData"\]\s*=\s*JSON\.parse\("((?:\\.|[^"\\])*)"\)/.exec(
      html
    );

  if (initialDataMatch) {
    return parseSearchResponse(decodeInitialDataJson(initialDataMatch[1]));
  }

  const ufrnPage = parseUfrnFetcherHtml(html);
  if (ufrnPage) return ufrnPage;

  throw new Error(
    `${portal.label}: données de recherche introuvables — ${describeClassifiedSearchHtmlFailure(portal, html)}`
  );
}
