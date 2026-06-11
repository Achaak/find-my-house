import vm from "node:vm";
import got, { HTTPError } from "got";
import type { GeoPoint } from "./geo.js";
import { bboxCenter } from "./geo.js";
import { resolveBienIciTravelOrigin } from "./geocode.js";
import type { GeoFilter } from "./geoFilter.js";

const BASE_URL = "https://www.seloger.com";
const IMAGE_BASE_URL = "https://v.seloger.com/s/width/800";

export const SELOGER_PAGE_SIZE = 35;
const MAX_PAGES = 50;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const BROWSER_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "fr-FR,fr;q=0.9",
  "User-Agent": USER_AGENT,
} as const;

const JSON_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "fr-FR,fr;q=0.9",
  Origin: BASE_URL,
  Referer: `${BASE_URL}/classified-search`,
  "User-Agent": USER_AGENT,
} as const;

export type SeLogerListingCriteria = {
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
};

export type SeLogerPlace = {
  name: string;
  center: GeoPoint;
  locationCode: string;
};

type BienIciSuggestResult = {
  name: string;
  insee_code?: string;
  boundingBox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
};

export type SeLogerPricing = {
  rawPrice?: string;
  price?: string;
};

export type SeLogerClassifiedCard = {
  id: number | string;
  cardType: string;
  publicationId?: number;
  title?: string;
  estateType?: string;
  pricing?: SeLogerPricing;
  surface?: number;
  rooms?: number;
  bedroomCount?: number;
  isNew?: boolean;
  cityLabel?: string;
  districtLabel?: string;
  zipCode?: string;
  description?: string;
  photos?: string[];
  classifiedURL?: string;
  tags?: string[];
};

type SeLogerSearchResponse = {
  cards?: {
    list?: SeLogerClassifiedCard[];
  };
  navigation?: {
    counts?: { count?: number };
    pagination?: { resultsPerPage?: number };
  };
};

type SeLogerClassifiedData = {
  id?: string;
  metadata?: { legacyId?: string };
  hardFacts?: {
    title?: string;
    keyfacts?: string[];
    price?: { formatted?: string };
  };
  location?: { address?: { city?: string; zipCode?: string } };
  gallery?: { images?: { url?: string }[] };
  mainDescription?: { description?: string };
  rawData?: {
    price?: number;
    propertyTypeLabel?: string;
    surface?: { main?: number };
    nbroom?: number;
    nbbedroom?: number;
  };
  tags?: { isNew?: boolean };
  url?: string;
};

type SeLogerUfrnPageProps = {
  classifieds?: string[];
  classifiedsData?: Record<string, SeLogerClassifiedData>;
  totalCount?: number;
};

function encodeSeLogerLocation(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

async function fetchBienIciSuggest(
  query: string
): Promise<BienIciSuggestResult[]> {
  const response = await got(
    `https://res.bienici.com/suggest.json?q=${encodeURIComponent(query.trim())}`,
    {
      headers: { Accept: "application/json" },
      throwHttpErrors: false,
    }
  );

  if (response.statusCode !== 200) return [];
  return JSON.parse(response.body) as BienIciSuggestResult[];
}

/** Resolves a city to a SeLoger place code (e.g. AD08FR76382). */
export async function resolveSeLogerPlace(
  city: string
): Promise<SeLogerPlace | null> {
  const results = await fetchBienIciSuggest(city);
  const cityLower = city.trim().toLowerCase();
  const match =
    results.find(
      (r) => r.insee_code && r.boundingBox && r.name.toLowerCase() === cityLower
    ) ?? results.find((r) => r.insee_code && r.boundingBox);

  if (!match?.insee_code || !match.boundingBox) return null;

  return {
    name: match.name,
    center: bboxCenter(match.boundingBox),
    locationCode: `AD08FR${match.insee_code}`,
  };
}

/** STRT origin point (e.g. STRTFR4383444) for travel-time filtering. */
export async function resolveSeLogerStrtPlaceId(
  center: GeoPoint
): Promise<string | null> {
  const url = new URL(`${BASE_URL}/serp-bff/places/point/place-id`);
  url.searchParams.set("lng", String(center.lng));
  url.searchParams.set("lat", String(center.lat));
  url.searchParams.set("typeKey", "STRT");

  const response = await got(url.toString(), {
    headers: JSON_HEADERS,
    throwHttpErrors: false,
  });
  if (response.statusCode !== 200) return null;

  const text = response.body.trim();
  if (!text || text.startsWith("{")) return null;

  return text.replace(/^"|"$/g, "");
}

export function buildSeLogerTravelLocation(
  strtPlaceId: string,
  durationMinutes: number
): string {
  return encodeSeLogerLocation({
    placeIds: [strtPlaceId],
    duration: String(durationMinutes),
    mode: "Car",
  });
}

export function buildSeLogerRadiusLocation(
  place: SeLogerPlace,
  radiusKm: number
): string {
  return encodeSeLogerLocation({
    placeId: place.locationCode,
    radius: radiusKm,
    coordinates: { lat: place.center.lat, lng: place.center.lng },
  });
}

export async function buildSeLogerLocation(
  city: string,
  place: SeLogerPlace,
  geoFilter: GeoFilter
): Promise<string> {
  if (geoFilter.mode === "travel") {
    const origin = (await resolveBienIciTravelOrigin(city)) ?? {
      address: place.name,
      center: place.center,
    };
    const strtPlaceId = await resolveSeLogerStrtPlaceId(origin.center);
    if (!strtPlaceId) {
      throw new Error(
        `Impossible de résoudre le point de départ STRT pour "${city}"`
      );
    }

    return buildSeLogerTravelLocation(strtPlaceId, geoFilter.maxTravelMinutes);
  }

  if (geoFilter.mode === "radius") {
    return buildSeLogerRadiusLocation(place, geoFilter.radiusKm);
  }

  return place.locationCode;
}

export function buildSeLogerSearchUrl(
  criteria: SeLogerListingCriteria,
  location: string,
  page = 1
): string {
  const params = new URLSearchParams();
  params.set("distributionTypes", "Buy");
  params.set("estateTypes", "House");
  params.set("locations", location);

  if (criteria.maxPrice !== undefined) {
    params.set("priceMax", String(criteria.maxPrice));
  }
  if (criteria.minSurface !== undefined) {
    params.set("spaceMin", String(criteria.minSurface));
  }
  if (criteria.minLandSurface !== undefined) {
    params.set("plotSpaceMin", String(criteria.minLandSurface));
  }
  if (criteria.minRooms !== undefined) {
    params.set("numberOfRoomsMin", String(criteria.minRooms));
  }
  if (criteria.minBedrooms !== undefined) {
    params.set("numberOfBedroomsMin", String(criteria.minBedrooms));
  }
  if (criteria.ancienOnly) {
    params.set("projectTypes", "Resale");
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  return `${BASE_URL}/classified-search?${params.toString()}`;
}

function extractJsonParseArg(html: string, varName: string): string | null {
  const marker = `window["${varName}"]=JSON.parse("`;
  const start = html.indexOf(marker);
  if (start === -1) return null;

  let i = start + marker.length;
  let arg = "";

  while (i < html.length) {
    const ch = html[i];
    if (ch === "\\") {
      arg += html.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === '"') break;
    arg += ch;
    i++;
  }

  return arg;
}

function parseEmbeddedWindowJson(varName: string, html: string): unknown {
  const arg = extractJsonParseArg(html, varName);
  if (!arg) return null;

  try {
    const jsonText = vm.runInNewContext(`"${arg}"`) as string;
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function mapClassifiedDataToCard(
  data: SeLogerClassifiedData
): SeLogerClassifiedCard | null {
  const id = data.metadata?.legacyId ?? data.id;
  if (!id) return null;

  const photos = data.gallery?.images
    ?.map((image) => image.url)
    .filter((url): url is string => Boolean(url));

  return {
    id,
    cardType: "classified",
    title: data.hardFacts?.title,
    estateType: data.rawData?.propertyTypeLabel,
    pricing: {
      rawPrice:
        data.rawData?.price !== undefined
          ? String(data.rawData.price)
          : undefined,
      price: data.hardFacts?.price?.formatted,
    },
    surface: data.rawData?.surface?.main,
    rooms: data.rawData?.nbroom,
    bedroomCount: data.rawData?.nbbedroom,
    isNew: data.tags?.isNew,
    cityLabel: data.location?.address?.city,
    zipCode: data.location?.address?.zipCode,
    description: data.mainDescription?.description,
    photos,
    classifiedURL: data.url,
    tags: data.hardFacts?.keyfacts,
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
    "SeLoger: données de recherche introuvables (protection anti-bot ?)"
  );
}

async function fetchSeLogerSearchPage(url: string): Promise<string> {
  try {
    return await got(url, { headers: BROWSER_HEADERS }).text();
  } catch (error) {
    if (error instanceof HTTPError) {
      throw new Error(`SeLoger: HTTP ${String(error.response.statusCode)}`, {
        cause: error,
      });
    }

    throw error;
  }
}

export async function fetchAllSeLogerClassifieds(
  searchUrl: string
): Promise<SeLogerClassifiedCard[]> {
  const firstHtml = await fetchSeLogerSearchPage(searchUrl);
  const firstPage = parseSeLogerSearchHtml(firstHtml);
  const allCards = [...firstPage.cards];

  const totalPages = Math.min(
    MAX_PAGES,
    Math.ceil(firstPage.totalCount / firstPage.resultsPerPage)
  );

  const baseUrl = new URL(searchUrl);
  baseUrl.searchParams.delete("page");

  for (let page = 2; page <= totalPages; page++) {
    baseUrl.searchParams.set("page", String(page));
    const html = await fetchSeLogerSearchPage(baseUrl.toString());
    const pageData = parseSeLogerSearchHtml(html);
    if (!pageData.cards.length) break;
    allCards.push(...pageData.cards);
  }

  return allCards;
}

export function parseSeLogerPrice(pricing?: SeLogerPricing): number {
  const raw = pricing?.rawPrice;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSeLogerBedrooms(
  card: SeLogerClassifiedCard
): number | null {
  if (card.bedroomCount !== undefined) return card.bedroomCount;

  const tag = card.tags?.find((t) => /\d+\s*chambre/i.test(t));
  if (!tag) return null;

  const match = /(\d+)/.exec(tag);
  return match ? Number(match[1]) : null;
}

export function buildSeLogerListingUrl(card: SeLogerClassifiedCard): string {
  if (!card.classifiedURL) {
    return `${BASE_URL}/annonces/achat/maison/${String(card.id)}.htm`;
  }

  if (card.classifiedURL.startsWith("http")) return card.classifiedURL;
  return `${BASE_URL}${card.classifiedURL}`;
}

export function buildSeLogerImageUrl(photoPath?: string): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("http")) return photoPath;
  return `${IMAGE_BASE_URL}${photoPath}`;
}
