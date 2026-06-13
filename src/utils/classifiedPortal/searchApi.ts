import type { PortalListingCriteria } from "../../types/listing.js";
import {
  browserPagePostJson,
  isBrowserAccessBlocked,
} from "../browser/client.js";
import { parseClassifiedUfrnSearchPageProps } from "./parsers/searchHtml.js";
import { isCityOnlyClassifiedLocation } from "./place.js";
import type {
  ClassifiedPortalConfig,
  ClassifiedUfrnPageProps,
} from "./types.js";
import { CLASSIFIED_PAGE_SIZE } from "./types.js";

const SERP_BFF_SEARCH_PATH = "/serp-bff/search";

type SerpBffSearchResponse = ClassifiedUfrnPageProps & {
  classifieds?: string[];
  classifiedsData?: ClassifiedUfrnPageProps["classifiedsData"];
};

function decodeLocationsParam(
  locations: string
): Record<string, unknown> | null {
  if (locations.startsWith("AD08FR")) {
    return { placeIds: [locations] };
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(locations, "base64url").toString("utf8")
    ) as Record<string, unknown>;

    if (typeof decoded.placeId === "string") {
      const location: Record<string, unknown> = {
        placeIds: [decoded.placeId],
      };
      if (typeof decoded.radius === "number") {
        location.radius = decoded.radius;
      }
      const coordinates = decoded.coordinates;
      if (coordinates !== null && typeof coordinates === "object") {
        location.coordinates = coordinates;
      }
      return location;
    }

    if (Array.isArray(decoded.placeIds)) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildSerpBffSearchRequest(searchUrl: string): {
  criteria: Record<string, unknown>;
  paging: { page: number; order: string };
} | null {
  const url = new URL(searchUrl);
  if (!url.pathname.includes("classified-search")) return null;

  const locations = url.searchParams.get("locations");
  if (!locations) return null;

  const location = decodeLocationsParam(locations);
  if (!location) return null;

  const criteria: Record<string, unknown> = {
    distributionTypes: [url.searchParams.get("distributionTypes") ?? "Buy"],
    estateTypes: [url.searchParams.get("estateTypes") ?? "House"],
    location,
  };

  const projectTypes = url.searchParams.get("projectTypes");
  if (projectTypes) {
    criteria.projectTypes = [projectTypes];
  } else {
    criteria.projectTypes = [
      "Life_Annuity",
      "New_Build",
      "Projected",
      "Resale",
    ];
  }

  for (const [param, key] of [
    ["priceMax", "priceMax"],
    ["priceMin", "priceMin"],
    ["spaceMin", "spaceMin"],
    ["spaceMax", "spaceMax"],
    ["plotSpaceMin", "plotSpaceMin"],
    ["numberOfRoomsMin", "numberOfRoomsMin"],
    ["numberOfBedroomsMin", "numberOfBedroomsMin"],
  ] as const) {
    const value = url.searchParams.get(param);
    if (value !== null) {
      const parsed = Number(value);
      criteria[key] = Number.isFinite(parsed) ? parsed : value;
    }
  }

  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const order = url.searchParams.get("order") ?? "Default";

  return { criteria, paging: { page, order } };
}

function parseSerpBffSearchResponse(data: SerpBffSearchResponse): {
  cards: ReturnType<typeof parseClassifiedUfrnSearchPageProps>["cards"];
  totalCount: number;
  resultsPerPage: number;
} | null {
  const hasCards =
    (data.classifieds?.length ?? 0) > 0 ||
    Object.keys(data.classifiedsData ?? {}).length > 0;

  if (!hasCards && (data.totalCount ?? 0) === 0) {
    return null;
  }

  return parseClassifiedUfrnSearchPageProps(data);
}

export async function fetchClassifiedSearchViaSerpBff(
  portal: ClassifiedPortalConfig,
  searchUrl: string
): Promise<ReturnType<typeof parseSerpBffSearchResponse>> {
  const request = buildSerpBffSearchRequest(searchUrl);
  if (!request) return null;

  try {
    const response = await browserPagePostJson(
      `${portal.baseUrl}${SERP_BFF_SEARCH_PATH}`,
      request,
      {
        warmUpOrigin: searchUrl,
        timeoutMs: 60_000,
      }
    );

    return parseSerpBffSearchResponse(response.data as SerpBffSearchResponse);
  } catch (error) {
    if (isBrowserAccessBlocked(error)) return null;
    throw error;
  }
}

export function filterClassifiedCardsBySearchUrl<
  T extends {
    pricing?: { rawPrice?: string };
    surface?: number;
    landSurface?: number;
    rooms?: number;
    bedroomCount?: number;
    isNew?: boolean;
  },
>(cards: T[], searchUrl: string, criteria?: PortalListingCriteria): T[] {
  const url = new URL(searchUrl);

  const maxPrice =
    criteria?.maxPrice ??
    (url.searchParams.get("priceMax")
      ? Number(url.searchParams.get("priceMax"))
      : undefined);
  const minSurface =
    criteria?.minSurface ??
    (url.searchParams.get("spaceMin")
      ? Number(url.searchParams.get("spaceMin"))
      : undefined);
  const minLandSurface =
    criteria?.minLandSurface ??
    (url.searchParams.get("plotSpaceMin")
      ? Number(url.searchParams.get("plotSpaceMin"))
      : undefined);
  const minRooms =
    criteria?.minRooms ??
    (url.searchParams.get("numberOfRoomsMin")
      ? Number(url.searchParams.get("numberOfRoomsMin"))
      : undefined);
  const minBedrooms =
    criteria?.minBedrooms ??
    (url.searchParams.get("numberOfBedroomsMin")
      ? Number(url.searchParams.get("numberOfBedroomsMin"))
      : undefined);
  const ancienOnly =
    criteria?.ancienOnly ?? url.searchParams.get("projectTypes") === "Resale";

  return cards.filter((card) => {
    const price = card.pricing?.rawPrice
      ? Number(card.pricing.rawPrice)
      : undefined;
    if (
      maxPrice !== undefined &&
      Number.isFinite(maxPrice) &&
      price !== undefined &&
      price > maxPrice
    ) {
      return false;
    }
    if (
      minSurface !== undefined &&
      card.surface !== undefined &&
      card.surface < minSurface
    ) {
      return false;
    }
    if (
      minLandSurface !== undefined &&
      card.landSurface !== undefined &&
      card.landSurface < minLandSurface
    ) {
      return false;
    }
    if (
      minRooms !== undefined &&
      card.rooms !== undefined &&
      card.rooms < minRooms
    ) {
      return false;
    }
    if (
      minBedrooms !== undefined &&
      card.bedroomCount !== undefined &&
      card.bedroomCount < minBedrooms
    ) {
      return false;
    }
    if (ancienOnly && card.isNew === true) {
      return false;
    }
    return true;
  });
}

export function isCityOnlyClassifiedSearchUrl(searchUrl: string): boolean {
  try {
    const locations = new URL(searchUrl).searchParams.get("locations");
    return Boolean(locations && isCityOnlyClassifiedLocation(locations));
  } catch {
    return false;
  }
}

export function filterClassifiedCardsByPostalCode<
  T extends { zipCode?: string },
>(cards: T[], postalCode: string): T[] {
  return cards.filter((card) => {
    if (!card.zipCode) return true;
    return card.zipCode === postalCode;
  });
}

export function classifiedSearchResultsPerPage(
  resultsPerPage: number | undefined
): number {
  return resultsPerPage && resultsPerPage > 0
    ? resultsPerPage
    : CLASSIFIED_PAGE_SIZE;
}
