import type {
  SeLogerClassifiedCard,
  SeLogerClassifiedData,
  SeLogerSearchResponse,
  SeLogerUfrnPageProps,
} from "../types.js";
import { SELOGER_PAGE_SIZE } from "../types.js";
import { mapClassifiedDataToCard } from "./classifiedCard.js";
import { parseEmbeddedWindowJson } from "./embeddedJson.js";
import { describeSeLogerSearchHtmlFailure } from "./htmlDiagnostics.js";

function decodeInitialDataJson(encoded: string): SeLogerSearchResponse {
  const decoded = encoded
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  return JSON.parse(decoded) as SeLogerSearchResponse;
}

function extractClassifiedCards(
  data: SeLogerSearchResponse
): SeLogerClassifiedCard[] {
  return (
    data.cards?.list?.filter((card) => card.cardType === "classified") ?? []
  );
}

function parseSearchResponse(data: SeLogerSearchResponse): {
  cards: SeLogerClassifiedCard[];
  totalCount: number;
  resultsPerPage: number;
} {
  const cards = extractClassifiedCards(data);
  return {
    cards,
    totalCount: data.navigation?.counts?.count ?? cards.length,
    resultsPerPage:
      data.navigation?.pagination?.resultsPerPage ?? SELOGER_PAGE_SIZE,
  };
}

function parseUfrnFetcherHtml(html: string): {
  cards: SeLogerClassifiedCard[];
  totalCount: number;
  resultsPerPage: number;
} | null {
  const fetcher = parseEmbeddedWindowJson("__UFRN_FETCHER__", html) as {
    data?: Record<string, { pageProps?: SeLogerUfrnPageProps }>;
  } | null;

  if (!fetcher?.data) return null;

  const pageProps = fetcher.data["classified-serp-init-data"].pageProps;
  if (!pageProps) return null;

  const classifiedsData = pageProps.classifiedsData ?? {};
  const cards = (pageProps.classifieds ?? [])
    .map((classifiedId) => classifiedsData[classifiedId])
    .filter((data): data is SeLogerClassifiedData => Boolean(data))
    .map(mapClassifiedDataToCard)
    .filter((card): card is SeLogerClassifiedCard => card !== null);

  const resultsPerPage = cards.length || SELOGER_PAGE_SIZE;

  return {
    cards,
    totalCount: pageProps.totalCount ?? cards.length,
    resultsPerPage,
  };
}

export function parseSeLogerSearchHtml(html: string): {
  cards: SeLogerClassifiedCard[];
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
    `SeLoger: données de recherche introuvables — ${describeSeLogerSearchHtmlFailure(html)}`
  );
}
