import vm from "node:vm";
import got, { HTTPError } from "got";
import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
  type EnergyMetrics,
} from "./energyMetrics.js";
import type { GeoPoint } from "./geo.js";
import { bboxCenter } from "./geo.js";
import { resolveBienIciTravelOrigin } from "./geocode.js";
import { estimateDrivingRadiusKm, type GeoFilter } from "./geoFilter.js";

const BASE_URL = "https://www.seloger.com";
const IMAGE_BASE_URL = "https://v.seloger.com/s/width/800";

export const SELOGER_PAGE_SIZE = 35;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const CLIENT_HINT_HEADERS = {
  "Sec-CH-UA":
    '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"macOS"',
} as const;

export class SeLogerAccessBlockedError extends Error {
  constructor(statusCode = 403) {
    super(
      `SeLoger bloque les requêtes automatisées (HTTP ${String(statusCode)}). ` +
        "Retirez seloger de SCRAPE_SCRAPERS pour ignorer cette source."
    );
    this.name = "SeLogerAccessBlockedError";
  }
}

function getSeLogerHeaders(
  kind: "html" | "json",
  extra: Record<string, string> = {}
): Record<string, string> {
  const base =
    kind === "html"
      ? {
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "fr-FR,fr;q=0.9",
          "User-Agent": USER_AGENT,
          ...CLIENT_HINT_HEADERS,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        }
      : {
          Accept: "application/json",
          "Accept-Language": "fr-FR,fr;q=0.9",
          Origin: BASE_URL,
          Referer: `${BASE_URL}/classified-search`,
          "User-Agent": USER_AGENT,
          ...CLIENT_HINT_HEADERS,
        };

  return { ...base, ...extra };
}

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
  energyClass?: string;
  gesClass?: string;
  dpeConsumptionKwhM2?: number;
  gesEmissionKgM2?: number;
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
  energyClass?: string;
  gesClass?: string;
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
    headers: getSeLogerHeaders("json"),
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
  radiusKm: number,
  center: GeoPoint = place.center
): string {
  return encodeSeLogerLocation({
    placeId: place.locationCode,
    radius: radiusKm,
    coordinates: { lat: center.lat, lng: center.lng },
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
    if (strtPlaceId) {
      return buildSeLogerTravelLocation(
        strtPlaceId,
        geoFilter.maxTravelMinutes
      );
    }

    const radiusKm = estimateDrivingRadiusKm(geoFilter.maxTravelMinutes);
    console.warn(
      `[seloger] point STRT indisponible pour "${city}", repli sur rayon estimé (~${String(Math.round(radiusKm))} km)`
    );
    return buildSeLogerRadiusLocation(place, radiusKm, origin.center);
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

function parseSeLogerEnergyClassesFromText(text: string): {
  dpeClass: string | null;
  gesClass: string | null;
} {
  const combinedMatch =
    /Classe énergie\s+([A-G])[\s,]+Classe climat\s+([A-G])/i.exec(text);
  if (combinedMatch) {
    return {
      dpeClass: combinedMatch[1].toUpperCase(),
      gesClass: combinedMatch[2].toUpperCase(),
    };
  }

  const dpeMatch = /(?:DPE|énergie)\s*[:\s]*([A-G])/i.exec(text);
  const gesMatch = /(?:GES|climat)\s*[:\s]*([A-G])/i.exec(text);

  return {
    dpeClass: dpeMatch?.[1]?.toUpperCase() ?? null,
    gesClass: gesMatch?.[1]?.toUpperCase() ?? null,
  };
}

/** Applies DPE/GES hints available on search cards (no detail page). */
export function applySeLogerSearchMetadata(
  card: SeLogerClassifiedCard
): SeLogerClassifiedCard {
  const text = [card.description, ...(card.tags ?? [])]
    .filter(Boolean)
    .join("\n");
  if (!text) return card;

  const parsed = parseSeLogerEnergyClassesFromText(text);
  const metrics = parseEnergyMetricsFromText(text);

  return {
    ...card,
    energyClass: card.energyClass ?? parsed.dpeClass ?? undefined,
    gesClass: card.gesClass ?? parsed.gesClass ?? undefined,
    dpeConsumptionKwhM2:
      card.dpeConsumptionKwhM2 ?? metrics.dpeConsumptionKwhM2 ?? undefined,
    gesEmissionKgM2:
      card.gesEmissionKgM2 ?? metrics.gesEmissionKgM2 ?? undefined,
  };
}

function mapClassifiedDataToCard(
  data: SeLogerClassifiedData
): SeLogerClassifiedCard | null {
  const id = data.metadata?.legacyId ?? data.id;
  if (!id) return null;

  const photos = data.gallery?.images
    ?.map((image) => image.url)
    .filter((url): url is string => Boolean(url));

  const description = data.mainDescription?.description;
  const keyfacts = data.hardFacts?.keyfacts;
  const textEnergy = parseSeLogerEnergyClassesFromText(
    [description, ...(keyfacts ?? [])].filter(Boolean).join("\n")
  );
  const metrics = parseEnergyMetricsFromText(description);

  return applySeLogerSearchMetadata({
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
    description,
    photos,
    classifiedURL: data.url,
    tags: keyfacts,
    energyClass: data.energyClass ?? textEnergy.dpeClass ?? undefined,
    gesClass: data.gesClass ?? textEnergy.gesClass ?? undefined,
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2 ?? undefined,
    gesEmissionKgM2: metrics.gesEmissionKgM2 ?? undefined,
  });
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

const SEARCH_PAGE_DELAY_MS = 800;
let lastSearchFetchAt = 0;

async function fetchSeLogerSearchPage(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, lastSearchFetchAt + SEARCH_PAGE_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastSearchFetchAt = Date.now();

  try {
    return await got(url, {
      headers: getSeLogerHeaders("html", { Referer: `${BASE_URL}/` }),
    }).text();
  } catch (error) {
    if (error instanceof HTTPError && error.response.statusCode === 403) {
      throw new SeLogerAccessBlockedError();
    }
    if (error instanceof HTTPError) {
      throw new Error(`SeLoger: HTTP ${String(error.response.statusCode)}`);
    }

    throw error;
  }
}

export async function fetchSeLogerClassifieds(
  searchUrl: string,
  maxPages = Number.POSITIVE_INFINITY
): Promise<SeLogerClassifiedCard[]> {
  const firstHtml = await fetchSeLogerSearchPage(searchUrl);
  const firstPage = parseSeLogerSearchHtml(firstHtml);
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

export type SeLogerEnergyDetails = EnergyMetrics & {
  dpeClass: string | null;
  gesClass: string | null;
};

/** @deprecated Use SeLogerEnergyDetails */
export type SeLogerEnergyClasses = Pick<
  SeLogerEnergyDetails,
  "dpeClass" | "gesClass"
>;

function extractEscapedScaleRating(
  html: string,
  scaleType: string
): string | null {
  const idx = html.indexOf(scaleType);
  if (idx === -1) return null;

  const slice = html.slice(Math.max(0, idx - 300), idx);
  const ratings = [...slice.matchAll(/\\"rating\\":\\"([A-G])\\"/gi)];
  return ratings.at(-1)?.[1]?.toUpperCase() ?? null;
}

function parseSeLogerDetailMetrics(html: string): EnergyMetrics {
  const fromText = parseEnergyMetricsFromText(html);

  const energyScaleIdx = html.indexOf("FR_ENERGY_AFTER_2021");
  const ghgScaleIdx = html.indexOf("FR_GHG_AFTER_2021");

  const extractScaleValue = (scaleIdx: number): number | null => {
    if (scaleIdx === -1) return null;
    const slice = html.slice(scaleIdx, scaleIdx + 500);
    const match =
      /\\"value\\":\\"(\d+(?:[.,]\d+)?)\s*kWh\/m²/i.exec(slice) ??
      /\\"value\\":\\"(\d+(?:[.,]\d+)?)\s*kg CO₂\/m²/i.exec(slice);
    if (!match) return null;
    const parsed = Number(match[1].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const consoFromScale =
    energyScaleIdx !== -1 ? extractScaleValue(energyScaleIdx) : null;
  const emissionFromScale =
    ghgScaleIdx !== -1 ? extractScaleValue(ghgScaleIdx) : null;

  return mergeEnergyMetrics(fromText, {
    dpeConsumptionKwhM2: consoFromScale,
    gesEmissionKgM2: emissionFromScale,
  });
}

/** Detail pages expose DPE/GES classes and numeric metrics. */
export function parseSeLogerDetailEnergy(html: string): SeLogerEnergyDetails {
  const fromText = parseSeLogerEnergyClassesFromText(html);
  const classes: SeLogerEnergyClasses =
    fromText.dpeClass && fromText.gesClass
      ? fromText
      : {
          dpeClass:
            fromText.dpeClass ??
            extractEscapedScaleRating(html, "FR_ENERGY_AFTER_2021"),
          gesClass:
            fromText.gesClass ??
            extractEscapedScaleRating(html, "FR_GHG_AFTER_2021"),
        };

  return { ...classes, ...parseSeLogerDetailMetrics(html) };
}

/** @deprecated Use parseSeLogerDetailEnergy */
export function parseSeLogerDetailEnergyClasses(
  html: string
): SeLogerEnergyClasses {
  const { dpeClass, gesClass } = parseSeLogerDetailEnergy(html);
  return { dpeClass, gesClass };
}

let lastDetailFetchAt = 0;
const DETAIL_FETCH_DELAY_MS = 400;

async function fetchSeLogerDetailHtml(url: string): Promise<string> {
  const now = Date.now();
  const wait = Math.max(0, lastDetailFetchAt + DETAIL_FETCH_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastDetailFetchAt = Date.now();

  return got(url, {
    headers: getSeLogerHeaders("html", {
      Referer: `${BASE_URL}/classified-search`,
      "Sec-Fetch-Site": "same-origin",
    }),
  }).text();
}

export type SeLogerListingDetails = SeLogerEnergyDetails & {
  description: string | null;
  landSurface: number | null;
  surface: number | null;
  bedrooms: number | null;
  rooms: number | null;
};

function parseSeLogerLandSurface(text: string): number | null {
  const match =
    /terrain\s*(?:de\s+)?(\d[\d\s]*)\s*m²/i.exec(text) ??
    /(\d[\d\s]*)\s*m²\s*(?:de\s+)?terrain/i.exec(text);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSeLogerDetailCard(html: string): SeLogerClassifiedCard | null {
  const fetcher = parseEmbeddedWindowJson("__UFRN_FETCHER__", html) as {
    data?: Record<
      string,
      { pageProps?: { classifiedData?: SeLogerClassifiedData } }
    >;
  } | null;

  const classifiedData =
    fetcher?.data?.["classified-detail-init-data"]?.pageProps?.classifiedData;
  if (classifiedData) return mapClassifiedDataToCard(classifiedData);

  const initialData = parseEmbeddedWindowJson("initialData", html) as {
    classified?: SeLogerClassifiedData;
  } | null;
  if (initialData?.classified) {
    return mapClassifiedDataToCard(initialData.classified);
  }

  return null;
}

export function parseSeLogerDetailPage(html: string): SeLogerListingDetails {
  const energy = parseSeLogerDetailEnergy(html);
  const card = parseSeLogerDetailCard(html);
  const text = [card?.description, ...(card?.tags ?? []), html]
    .filter(Boolean)
    .join("\n");

  return {
    ...energy,
    description: card?.description ?? null,
    surface: card?.surface ?? null,
    bedrooms: card?.bedroomCount ?? null,
    rooms: card?.rooms ?? null,
    landSurface: parseSeLogerLandSurface(text),
  };
}

export async function fetchSeLogerListingDetails(
  url: string
): Promise<SeLogerListingDetails> {
  const html = await fetchSeLogerDetailHtml(url);
  return parseSeLogerDetailPage(html);
}

export async function fetchSeLogerDetailEnergy(
  url: string
): Promise<SeLogerEnergyDetails> {
  const html = await fetchSeLogerDetailHtml(url);
  return parseSeLogerDetailEnergy(html);
}

/** @deprecated Use fetchSeLogerDetailEnergy */
export async function fetchSeLogerDetailEnergyClasses(
  url: string
): Promise<SeLogerEnergyClasses> {
  const { dpeClass, gesClass } = await fetchSeLogerDetailEnergy(url);
  return { dpeClass, gesClass };
}

const ENERGY_ENRICH_CONCURRENCY = 2;

function formatFetchError(error: unknown): string {
  if (error instanceof HTTPError) {
    return `HTTP ${String(error.response.statusCode)}`;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function enrichSeLogerCardsEnergy(
  cards: SeLogerClassifiedCard[]
): Promise<SeLogerClassifiedCard[]> {
  const cardsWithTextEnergy = cards.map(applySeLogerSearchMetadata);
  const needsEnrichment = cardsWithTextEnergy.filter(
    (card) => !card.gesClass || !card.energyClass
  );
  if (needsEnrichment.length === 0) return cardsWithTextEnergy;

  const enrichedById = new Map<string | number, SeLogerClassifiedCard>();
  let index = 0;
  let blockedCount = 0;

  async function enrichNext(): Promise<void> {
    while (index < needsEnrichment.length) {
      const card = needsEnrichment[index];
      index += 1;

      try {
        const url = buildSeLogerListingUrl(card);
        const energy = await fetchSeLogerDetailEnergy(url);
        enrichedById.set(card.id, {
          ...card,
          energyClass: card.energyClass ?? energy.dpeClass ?? undefined,
          gesClass: card.gesClass ?? energy.gesClass ?? undefined,
          dpeConsumptionKwhM2:
            card.dpeConsumptionKwhM2 ?? energy.dpeConsumptionKwhM2 ?? undefined,
          gesEmissionKgM2:
            card.gesEmissionKgM2 ?? energy.gesEmissionKgM2 ?? undefined,
        });
      } catch (error) {
        if (error instanceof HTTPError && error.response.statusCode === 403) {
          blockedCount += 1;
        } else {
          console.warn(
            `[seloger] Énergie introuvable pour l'annonce ${String(card.id)}: ${formatFetchError(error)}`
          );
        }
        enrichedById.set(card.id, card);
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(ENERGY_ENRICH_CONCURRENCY, needsEnrichment.length) },
    () => enrichNext()
  );
  await Promise.all(workers);

  if (blockedCount > 0) {
    console.warn(
      `[seloger] ${String(blockedCount)} page(s) détail bloquée(s) (HTTP 403) — DPE/GES conservés depuis la recherche`
    );
  }

  return cardsWithTextEnergy.map((card) => enrichedById.get(card.id) ?? card);
}
