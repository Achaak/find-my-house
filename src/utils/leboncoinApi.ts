import type { GeoPoint } from "./geo.js";

const SEARCH_URL = "https://api.leboncoin.fr/finder/search";
const LOCATION_URL =
  "https://api.leboncoin.fr/api/parrot-location/v1/complete/location";

const CATEGORY_VENTES_IMMO = "9";
const REAL_ESTATE_MAISON = "1";
export const LEBONCOIN_PAGE_SIZE = 35;
const MAX_PAGES = 50;

const JSON_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  api_key: "ba0c2dad52b3ec",
  "User-Agent":
    "LBC;iOS;16.4.1;iPhone;phone;AFACB532-200B-476A-98B3-B2346A97EA54;wifi;6.102.0;24.32.1930",
  "Accept-Language": "fr-FR,fr;q=0.9",
} as const;

export type LeboncoinListingCriteria = {
  maxPrice?: number;
  minSurface?: number;
  minLandSurface?: number;
  minRooms?: number;
  minBedrooms?: number;
  ancienOnly?: boolean;
};

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

type LeboncoinSearchBody = {
  filters: {
    category: { id: string };
    enums: Record<string, string[]>;
    ranges: Record<string, { min?: number; max?: number }>;
    location: {
      locations: LeboncoinLocation[];
      shippable: boolean;
    };
  };
  limit: number;
  owner_type: string;
  sort_by: string;
  sort_order: string;
  pivot?: string;
};

type LeboncoinSearchResult = {
  total: number;
  pivot?: string;
  ads?: LeboncoinAd[];
};

export async function resolveLeboncoinPlace(
  city: string
): Promise<LeboncoinPlace | null> {
  const response = await fetch(LOCATION_URL, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ context: [], text: city.trim() }),
  });

  if (!response.ok) return null;

  const locations = (await response.json()) as LeboncoinLocation[];
  const cityLower = city.trim().toLowerCase();
  const match =
    locations.find(
      (loc) =>
        loc.locationType === "city" &&
        (loc.label?.toLowerCase() === cityLower ||
          loc.city?.toLowerCase() === cityLower)
    ) ?? locations.find((loc) => loc.locationType === "city");

  if (!match?.area) return null;

  const center = { lat: match.area.lat, lng: match.area.lng };

  return {
    name: match.label ?? match.city ?? city,
    center,
    location: match,
  };
}

/** Recherche par rayon (mètres), comme sur leboncoin.fr/recherche?locations=... */
export function buildLeboncoinAreaLocation(
  place: LeboncoinPlace,
  radiusKm: number
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
      lat: place.center.lat,
      lng: place.center.lng,
      radius: radiusKm * 1000,
      default_radius: defaultRadius,
    },
  };
}

export function buildLeboncoinSearchBody(
  criteria: LeboncoinListingCriteria,
  location: LeboncoinLocation
): LeboncoinSearchBody {
  const enums: Record<string, string[]> = {
    ad_type: ["offer"],
    real_estate_type: [REAL_ESTATE_MAISON],
  };

  if (criteria.ancienOnly) {
    enums.immo_sell_type = ["old"];
  }

  const ranges: Record<string, { min?: number; max?: number }> = {};

  if (criteria.maxPrice !== undefined) {
    ranges.price = { max: criteria.maxPrice };
  }
  if (criteria.minSurface !== undefined) {
    ranges.square = { min: criteria.minSurface };
  }
  if (criteria.minLandSurface !== undefined) {
    ranges.land_plot_surface = { min: criteria.minLandSurface };
  }
  if (criteria.minRooms !== undefined) {
    ranges.rooms = { min: criteria.minRooms };
  }
  if (criteria.minBedrooms !== undefined) {
    ranges.bedrooms = { min: criteria.minBedrooms };
  }

  return {
    filters: {
      category: { id: CATEGORY_VENTES_IMMO },
      enums,
      ranges,
      location: {
        locations: [location],
        shippable: false,
      },
    },
    limit: LEBONCOIN_PAGE_SIZE,
    owner_type: "all",
    sort_by: "time",
    sort_order: "desc",
  };
}

async function fetchLeboncoinPage(
  body: LeboncoinSearchBody
): Promise<LeboncoinSearchResult> {
  const response = await fetch(SEARCH_URL, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`LeBonCoin API: HTTP ${String(response.status)}`);
  }

  return response.json() as Promise<LeboncoinSearchResult>;
}

export async function fetchAllLeboncoinAds(
  body: LeboncoinSearchBody
): Promise<LeboncoinAd[]> {
  const allAds: LeboncoinAd[] = [];
  let pivot = "";
  let lastPivot = "";

  for (let page = 0; page < MAX_PAGES; page++) {
    const result = await fetchLeboncoinPage({
      ...body,
      pivot: pivot || undefined,
    });

    if (!result.ads?.length) break;

    allAds.push(...result.ads);

    if (!result.pivot || result.pivot === lastPivot) break;

    lastPivot = result.pivot;
    pivot = result.pivot;
  }

  return allAds;
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
