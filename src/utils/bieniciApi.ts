import got, { HTTPError } from "got";
import type { GeoPoint } from "./geo.js";

const AUTH_URL =
  "https://account.bienici.com/autoAuthenticate?createGuestAccountOnFailure";
const ZONE_URL = "https://www.bienici.com/zone-by-time";
const ADS_URL = "https://www.bienici.com/realEstateAds.json";
export const BIENICI_PAGE_SIZE = 24;

export type BienIciZoneIdsByTypes = {
  zoneIds?: string[];
  travelTimeZone?: string[];
};

export type BienIciListingCriteria = {
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
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

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0",
} as const;

export function buildBienIciSearchFilters(
  criteria: BienIciListingCriteria,
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

export async function computeBienIciTravelZone(
  params: {
    center: GeoPoint;
    address: string;
    durationMinutes: number;
    mode?: "car";
  },
  retried = false
): Promise<string> {
  const session = await getGuestSession();

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
      })
      .json<ZoneByTimeResponse>();
  } catch (error) {
    if (error instanceof HTTPError) {
      if (error.response.statusCode === 401) {
        if (retried) {
          throw new Error("BienIci zone-by-time: non autorisé", {
            cause: error,
          });
        }
        clearGuestSession();
        return computeBienIciTravelZone(params, true);
      }

      throw new Error(
        `BienIci zone-by-time: HTTP ${String(error.response.statusCode)}`,
        { cause: error }
      );
    }

    throw error;
  }
  const zoneId = data.zone?._id;

  if (!data.success || !zoneId) {
    throw new Error("BienIci zone-by-time: zone introuvable");
  }

  return zoneId;
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
    if (error instanceof HTTPError) {
      throw new Error(
        `BienIci API page ${String(page)}: HTTP ${String(error.response.statusCode)}`,
        { cause: error }
      );
    }

    throw error;
  }
}

export async function fetchAllBienIciAds<T extends { id: string }>(
  filters: BienIciSearchFilters
): Promise<T[]> {
  const firstPage = await fetchBienIciPage<T>(filters, 1);
  const allAds = [...firstPage.realEstateAds];
  const totalPages = Math.ceil(firstPage.total / BIENICI_PAGE_SIZE);

  for (let page = 2; page <= totalPages; page++) {
    const data = await fetchBienIciPage<T>(filters, page);
    allAds.push(...data.realEstateAds);
  }

  return allAds;
}

export async function fetchBienIciExternalIds(
  filters: BienIciSearchFilters
): Promise<Set<string>> {
  const allAds = await fetchAllBienIciAds<{ id: string }>(filters);
  return new Set(allAds.map((ad) => ad.id));
}
