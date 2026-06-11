import got, { HTTPError } from "got";
import type { PortalListingCriteria } from "../types/listing.js";
import type { GeoPoint } from "./geo.js";
import { wrapHttpError } from "./httpError.js";

const AUTH_URL =
  "https://account.bienici.com/autoAuthenticate?createGuestAccountOnFailure";
const ZONE_URL = "https://www.bienici.com/zone-by-time";
const ADS_URL = "https://www.bienici.com/realEstateAds.json";
export const BIENICI_PAGE_SIZE = 24;

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

const ZONE_MAX_ATTEMPTS = 4;
const ZONE_BASE_DELAY_MS = 1500;

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
} as const;

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

async function getGuestSession(): Promise<GuestSession> {
  if (cachedSession) return cachedSession;

  const data = await got
    .post(AUTH_URL, {
      headers: JSON_HEADERS,
      body: "{}",
    })
    .json<{ account?: { id: string; token: string } }>();

  if (!data.account?.id || !data.account.token) {
    throw new Error("BienIci auth: réponse invalide");
  }

  cachedSession = {
    accountId: data.account.id,
    token: data.account.token,
  };
  return cachedSession;
}

function clearGuestSession(): void {
  cachedSession = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableZoneError(error: unknown): boolean {
  if (!(error instanceof HTTPError)) return true;
  const status = error.response.statusCode;
  return status === 401 || status === 408 || status >= 500;
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
  let data: ZoneByTimeResponse;

  try {
    data = await got
      .post(ZONE_URL, {
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${session.token}`,
        },
        json: {
          duration: params.durationMinutes * 60,
          lat: params.center.lat,
          lng: params.center.lng,
          address: params.address,
          mode: params.mode ?? "car",
          accountId: session.accountId,
        },
        retry: {
          limit: 2,
          methods: ["POST"],
          statusCodes: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
        },
      })
      .json<ZoneByTimeResponse>();
  } catch (error) {
    wrapHttpError("BienIci zone-by-time", error);
  }

  const zoneId = data.zone?._id;

  if (!data.success || !zoneId) {
    throw new Error("BienIci zone-by-time: zone introuvable");
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
  try {
    return await got(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    }).json<BienIciAdsPage<T>>();
  } catch (error) {
    wrapHttpError(`BienIci API page ${String(page)}`, error);
  }
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
    const page = await got(url, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
    }).json<BienIciAdsPage<T>>();
    return page.realEstateAds[0] ?? null;
  } catch (error) {
    wrapHttpError(`BienIci annonce ${id}`, error);
  }
}
