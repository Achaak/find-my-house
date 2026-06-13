import type { PortalListingCriteria } from "../../types/listing.js";
import { resolveGeoSearchCenter } from "../geo/geocode.js";
import type { GeoPoint } from "../geo/geo.js";
import {
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
} from "../browser/delays.js";
import { retryBrowserOperation } from "../browser/retryFetch.js";
import {
  browserPagePostJson,
  fetchPageHtml,
  isBrowserAccessBlocked,
  warmUpBrowserSession,
} from "../browser/client.js";
import { wrapHttpError } from "../errors/httpError.js";
import { LeboncoinAccessBlockedError } from "./errors.js";
import { parseLeboncoinDetailHtml } from "./parsers/detailHtml.js";
import {
  buildLeboncoinSearchRequest,
  LEBONCOIN_SEARCH_API,
  parseLeboncoinSearchResponse,
} from "./searchApi.js";

export const LEBONCOIN_ORIGIN = "https://www.leboncoin.fr/";
export const LEBONCOIN_PAGE_SIZE = 35;

export {
  DETAIL_FETCH_DELAY_MS,
  SEARCH_PAGE_DELAY_MS,
} from "../browser/delays.js";

const SEARCH_REQUEST_TIMEOUT_MS = 60_000;
const SEARCH_PARSE_MAX_ATTEMPTS = 4;
const SEARCH_PARSE_RETRY_DELAY_MS = 4_000;

let lastSearchFetchAt = 0;
let lastDetailFetchAt = 0;

export type LeboncoinLocation = {
  locationType: string;
  label?: string;
  city?: string;
  zipcode?: string;
  department_id?: string;
  region_id?: string;
  area?: {
    lat: number;
    lng: number;
    default_radius: number;
    radius?: number;
  };
};

export type LeboncoinPlace = {
  name: string;
  center: GeoPoint;
  location: LeboncoinLocation;
};

export type LeboncoinAdAttribute = {
  key: string;
  value: string;
  value_label?: string;
};

export type LeboncoinAd = {
  list_id: number;
  subject: string;
  body: string;
  url: string;
  price: number[];
  images?: {
    urls_large?: string[];
    urls?: string[];
    thumb_url?: string;
  };
  attributes: LeboncoinAdAttribute[];
  location: {
    city: string;
    city_label?: string;
    zipcode?: string;
    lat: number;
    lng: number;
  };
};

function handleLeboncoinFetchError(error: unknown): never {
  if (isBrowserAccessBlocked(error)) {
    throw new LeboncoinAccessBlockedError(error.statusCode);
  }
  wrapHttpError("LeBonCoin", error);
}

async function throttleSearchFetch(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastSearchFetchAt + SEARCH_PAGE_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastSearchFetchAt = Date.now();
}

async function throttleDetailFetch(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastDetailFetchAt + DETAIL_FETCH_DELAY_MS - now);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastDetailFetchAt = Date.now();
}

async function fetchAndParseLeboncoinSearchPage(
  criteria: PortalListingCriteria,
  location: LeboncoinLocation,
  page: number
): Promise<ReturnType<typeof parseLeboncoinSearchResponse>> {
  return retryBrowserOperation({
    maxAttempts: SEARCH_PARSE_MAX_ATTEMPTS,
    retryDelayMs: SEARCH_PARSE_RETRY_DELAY_MS,
    warmUpOrigin: LEBONCOIN_ORIGIN,
    clearCookiesHost: "www.leboncoin.fr",
    beforeEachAttempt: throttleSearchFetch,
    onAccessBlocked: handleLeboncoinFetchError,
    run: async () => {
      const request = buildLeboncoinSearchRequest(
        criteria,
        location,
        page,
        LEBONCOIN_PAGE_SIZE
      );
      const response = await browserPagePostJson(
        LEBONCOIN_SEARCH_API,
        request,
        {
          warmUpOrigin: LEBONCOIN_ORIGIN,
          timeoutMs: SEARCH_REQUEST_TIMEOUT_MS,
        }
      );

      return parseLeboncoinSearchResponse(
        response.data as {
          ads?: LeboncoinAd[];
          total?: number;
          max_pages?: number;
        }
      );
    },
  });
}

export async function resolveLeboncoinPlaceFromGeocode(
  city: string,
  postalCode?: string
): Promise<LeboncoinPlace | null> {
  const geo = await resolveGeoSearchCenter(city, postalCode);
  if (!geo) return null;

  return {
    name: geo.placeName,
    center: geo.center,
    location: {
      locationType: "city",
      label: geo.placeName,
      city,
      zipcode: geo.zipcode,
      area: {
        lat: geo.center.lat,
        lng: geo.center.lng,
        default_radius: 5000,
      },
    },
  };
}

export async function resolveLeboncoinPlace(
  city: string,
  postalCode?: string
): Promise<LeboncoinPlace | null> {
  return resolveLeboncoinPlaceFromGeocode(city, postalCode);
}

/** Radius search (meters), as on leboncoin.fr/recherche?locations=... */
export function buildLeboncoinAreaLocation(
  place: LeboncoinPlace,
  radiusKm: number,
  center: GeoPoint = place.center
): LeboncoinLocation {
  const defaultRadius = place.location.area?.default_radius ?? 5000;

  return {
    locationType: "area",
    label: place.location.label,
    city: place.location.city,
    zipcode: place.location.zipcode,
    department_id: place.location.department_id,
    region_id: place.location.region_id,
    area: {
      lat: center.lat,
      lng: center.lng,
      radius: Math.round(radiusKm * 1000),
      default_radius: defaultRadius,
    },
  };
}

async function fetchLeboncoinAdsForPage(
  criteria: PortalListingCriteria,
  location: LeboncoinLocation,
  maxPages: number
): Promise<LeboncoinAd[]> {
  const firstPage = await fetchAndParseLeboncoinSearchPage(
    criteria,
    location,
    1
  );
  const allAds = [...firstPage.ads];

  if (maxPages <= 1) return allAds;

  const totalPages = Math.min(maxPages, firstPage.maxPages);

  for (let page = 2; page <= totalPages; page++) {
    const pageData = await fetchAndParseLeboncoinSearchPage(
      criteria,
      location,
      page
    );
    if (!pageData.ads.length) break;
    allAds.push(...pageData.ads);
  }

  return allAds;
}

export async function fetchLeboncoinAds(
  criteria: PortalListingCriteria,
  location: LeboncoinLocation,
  maxPages = Number.POSITIVE_INFINITY
): Promise<LeboncoinAd[]> {
  return fetchLeboncoinAdsForPage(criteria, location, maxPages);
}

export async function fetchLeboncoinAdById(
  listId: string
): Promise<LeboncoinAd | null> {
  const url = `${LEBONCOIN_ORIGIN}ad/ventes_immobilieres/${listId}`;

  try {
    await warmUpBrowserSession(LEBONCOIN_ORIGIN);
    await throttleDetailFetch();
    const html = await fetchPageHtml(url, {
      referer: `${LEBONCOIN_ORIGIN}recherche`,
      timeoutMs: 30_000,
    });
    return parseLeboncoinDetailHtml(html);
  } catch (error) {
    if (error instanceof Error && error.message.includes("introuvable")) {
      return null;
    }
    handleLeboncoinFetchError(error);
  }
}

export function getLeboncoinAttribute(
  ad: LeboncoinAd,
  key: string
): string | undefined {
  return ad.attributes.find((attr) => attr.key === key)?.value;
}

export function parseLeboncoinNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
