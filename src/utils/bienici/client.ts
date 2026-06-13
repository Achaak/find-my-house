import type { PortalListingCriteria } from "../../types/listing.js";
import type { GeoPoint } from "../geo/geo.js";
import { SEARCH_PAGE_DELAY_MS } from "../browser/delays.js";
import {
  BrowserHttpError,
  browserPageFetch,
  browserPagePostJson,
  fetchPageHtml,
  isBrowserAccessBlocked,
  warmUpBrowserSession,
} from "../browser/client.js";
import { wrapHttpError } from "../errors/httpError.js";

const AUTH_URL =
  "https://account.bienici.com/autoAuthenticate?createGuestAccountOnFailure";
const ZONE_URL = "https://www.bienici.com/zone-by-time";
const ADS_URL = "https://www.bienici.com/realEstateAds.json";
export const BIENICI_ORIGIN = "https://www.bienici.com/";
export const BIENICI_PAGE_SIZE = 24;

export { SEARCH_PAGE_DELAY_MS };

const REQUEST_TIMEOUT_MS = 60_000;
const ZONE_MAX_ATTEMPTS = 4;
const ZONE_BASE_DELAY_MS = 1500;
const SEARCH_MAX_ATTEMPTS = 4;
const SEARCH_RETRY_DELAY_MS = 4_000;

export type BienIciZoneIdsByTypes = {
  zoneIds?: string[];
  travelTimeZone?: string[];
};

export type BienIciSearchFilters = {
  size: number;
  from: number;
  page: number;
  filterType: string;
  propertyType: string[];
  maxPrice?: number;
  minArea?: number;
  sortBy: string;
  sortOrder: string;
  onTheMarket: boolean[];
  zoneIdsByTypes: BienIciZoneIdsByTypes;
  minRooms?: number;
  minBedrooms?: number;
  minGardenSurfaceArea?: number;
  newProperty?: boolean;
};

type GuestSession = {
  accountId: string;
  token: string;
};

type ZoneByTimeResponse = {
  success: boolean;
  zone?: { _id: string };
  errors?: unknown;
};

type BienIciAdsPage<T> = {
  realEstateAds: T[];
  total: number;
};

let cachedSession: GuestSession | null = null;
let lastSearchFetchAt = 0;

export function buildBienIciSearchFilters(
  criteria: PortalListingCriteria,
  zoneIdsByTypes: BienIciZoneIdsByTypes
): BienIciSearchFilters {
  const filters: BienIciSearchFilters = {
    size: BIENICI_PAGE_SIZE,
    from: 0,
    page: 1,
    filterType: "buy",
    propertyType: ["house"],
    maxPrice: criteria.maxPrice,
    minArea: criteria.minSurface,
    sortBy: "relevance",
    sortOrder: "desc",
    onTheMarket: [true],
    zoneIdsByTypes,
  };

  if (criteria.minRooms !== undefined) filters.minRooms = criteria.minRooms;
  if (criteria.minBedrooms !== undefined) {
    filters.minBedrooms = criteria.minBedrooms;
  }
  if (criteria.minLandSurface !== undefined) {
    filters.minGardenSurfaceArea = criteria.minLandSurface;
  }
  if (criteria.ancienOnly) filters.newProperty = false;

  return filters;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clearGuestSession(): void {
  cachedSession = null;
}

function isRetryableZoneError(error: unknown): boolean {
  if (error instanceof BrowserHttpError) {
    return (
      error.statusCode === 401 ||
      error.statusCode === 408 ||
      error.statusCode >= 500
    );
  }
  return true;
}

async function throttleSearchFetch(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, lastSearchFetchAt + SEARCH_PAGE_DELAY_MS - now);
  if (wait > 0) {
    await sleep(wait);
  }
  lastSearchFetchAt = Date.now();
}

async function getGuestSession(): Promise<GuestSession> {
  if (cachedSession) return cachedSession;

  await warmUpBrowserSession(BIENICI_ORIGIN);
  const response = await browserPagePostJson(
    AUTH_URL,
    {},
    {
      warmUpOrigin: BIENICI_ORIGIN,
      timeoutMs: REQUEST_TIMEOUT_MS,
    }
  );

  const data = response.data as {
    account?: { id: string; token: string };
  };
  if (!data.account?.id || !data.account.token) {
    throw new Error("BienIci auth: invalid response");
  }

  cachedSession = {
    accountId: data.account.id,
    token: data.account.token,
  };
  return cachedSession;
}

async function requestBienIciTravelZone(
  params: {
    center: GeoPoint;
    address: string;
    durationMinutes: number;
    mode?: "car";
  },
  session: GuestSession
): Promise<string> {
  await warmUpBrowserSession(BIENICI_ORIGIN);
  const response = await browserPagePostJson(
    ZONE_URL,
    {
      duration: params.durationMinutes * 60,
      lat: params.center.lat,
      lng: params.center.lng,
      address: params.address,
      mode: params.mode ?? "car",
      accountId: session.accountId,
    },
    {
      warmUpOrigin: BIENICI_ORIGIN,
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: { Authorization: `Bearer ${session.token}` },
    }
  );

  const data = response.data as ZoneByTimeResponse;
  const zoneId = data.zone?._id;

  if (!data.success || !zoneId) {
    throw new Error("BienIci zone-by-time: zone not found");
  }

  return zoneId;
}

export async function computeBienIciTravelZone(params: {
  center: GeoPoint;
  address: string;
  durationMinutes: number;
  mode?: "car";
}): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= ZONE_MAX_ATTEMPTS; attempt++) {
    try {
      const session = await getGuestSession();
      return await requestBienIciTravelZone(params, session);
    } catch (error) {
      lastError = error;

      if (!isRetryableZoneError(error) || attempt === ZONE_MAX_ATTEMPTS) {
        throw error;
      }

      clearGuestSession();
      await sleep(ZONE_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }

  throw lastError;
}

async function fetchBienIciPage<T>(
  filters: BienIciSearchFilters,
  page: number
): Promise<BienIciAdsPage<T>> {
  const from = (page - 1) * BIENICI_PAGE_SIZE;
  const pageFilters = { ...filters, from, page, size: BIENICI_PAGE_SIZE };
  const url = `${ADS_URL}?filters=${encodeURIComponent(JSON.stringify(pageFilters))}`;

  let lastError: unknown;

  for (let attempt = 1; attempt <= SEARCH_MAX_ATTEMPTS; attempt++) {
    await warmUpBrowserSession(BIENICI_ORIGIN);
    await throttleSearchFetch();

    try {
      const response = await browserPageFetch(url, {
        warmUpOrigin: BIENICI_ORIGIN,
        timeoutMs: REQUEST_TIMEOUT_MS,
        headers: { Accept: "application/json" },
      });

      if (response.status >= 400) {
        throw new BrowserHttpError(
          response.status,
          response.body.slice(0, 120)
        );
      }

      return JSON.parse(response.body) as BienIciAdsPage<T>;
    } catch (error) {
      lastError = error;

      if (isBrowserAccessBlocked(error) && attempt < SEARCH_MAX_ATTEMPTS) {
        clearGuestSession();
        await sleep(SEARCH_RETRY_DELAY_MS * attempt);
        continue;
      }

      wrapHttpError(`BienIci API page ${String(page)}`, error);
    }
  }

  wrapHttpError(`BienIci API page ${String(page)}`, lastError);
}

export async function fetchBienIciAds<T extends { id: string }>(
  filters: BienIciSearchFilters,
  maxPages = Number.POSITIVE_INFINITY
): Promise<T[]> {
  const firstPage = await fetchBienIciPage<T>(filters, 1);
  const allAds = [...firstPage.realEstateAds];

  if (maxPages <= 1) return allAds;

  const totalPages = Math.min(
    maxPages,
    Math.ceil(firstPage.total / BIENICI_PAGE_SIZE)
  );

  for (let page = 2; page <= totalPages; page++) {
    const data = await fetchBienIciPage<T>(filters, page);
    allAds.push(...data.realEstateAds);
  }

  return allAds;
}

export async function fetchBienIciAdById<T extends { id: string }>(
  id: string
): Promise<T | null> {
  const filters = {
    size: 1,
    from: 0,
    page: 1,
    filterType: "buy",
    propertyType: ["house", "flat", "loft", "castle", "townhouse", "villa"],
    sortBy: "relevance",
    sortOrder: "desc",
    onTheMarket: [true],
    zoneIdsByTypes: {},
    id,
  } satisfies BienIciSearchFilters & { id: string };

  const url = `${ADS_URL}?filters=${encodeURIComponent(JSON.stringify(filters))}`;

  try {
    await warmUpBrowserSession(BIENICI_ORIGIN);
    const response = await browserPageFetch(url, {
      warmUpOrigin: BIENICI_ORIGIN,
      timeoutMs: REQUEST_TIMEOUT_MS,
      headers: { Accept: "application/json" },
    });

    if (response.status >= 400) {
      throw new BrowserHttpError(response.status, response.body.slice(0, 120));
    }

    const page = JSON.parse(response.body) as BienIciAdsPage<T>;
    return page.realEstateAds[0] ?? null;
  } catch (error) {
    wrapHttpError(`BienIci listing ${id}`, error);
  }
}

export async function fetchBienIciListingHtml(url: string): Promise<string> {
  await warmUpBrowserSession(BIENICI_ORIGIN);
  return fetchPageHtml(url, {
    referer: BIENICI_ORIGIN,
    timeoutMs: REQUEST_TIMEOUT_MS,
  });
}
