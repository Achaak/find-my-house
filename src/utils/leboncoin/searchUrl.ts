import type { PortalListingCriteria } from "../../types/listing.js";
import type { LeboncoinLocation } from "./client.js";

const SEARCH_BASE = "https://www.leboncoin.fr/recherche";
const CATEGORY_VENTES_IMMO = "9";
const REAL_ESTATE_MAISON = "1";

function formatCoord(value: number): string {
  return value.toFixed(2);
}

export function encodeLeboncoinWebLocation(
  location: LeboncoinLocation
): string | null {
  if (location.locationType === "area" && location.area) {
    const zip = location.zipcode?.trim();
    if (!zip) return null;

    const slug = (location.city ?? location.label?.split(" (")[0] ?? "zone")
      .trim()
      .replace(/\s+/g, "_");
    const lat = formatCoord(location.area.lat);
    const lng = formatCoord(location.area.lng);
    const radius = location.area.radius ?? location.area.default_radius;
    return `${slug}_${zip}__${lat}_${lng}_${String(radius)}`;
  }

  if (location.locationType === "city" && location.department_id) {
    return `d_${location.department_id}`;
  }

  return null;
}

export type LeboncoinSearchUrlMode = "locations" | "text";

function resolveLeboncoinSearchText(
  location: LeboncoinLocation
): string | null {
  if (location.city?.trim()) return location.city.trim();
  const fromLabel = location.label?.split(" (")[0]?.trim();
  return fromLabel ?? location.label?.trim() ?? null;
}

export function buildLeboncoinSearchUrl(
  criteria: PortalListingCriteria,
  location: LeboncoinLocation,
  page = 1,
  mode: LeboncoinSearchUrlMode = "locations"
): string {
  const params = new URLSearchParams();
  params.set("category", CATEGORY_VENTES_IMMO);
  params.set("real_estate_type", REAL_ESTATE_MAISON);

  if (mode === "text") {
    const text = resolveLeboncoinSearchText(location);
    if (text) params.set("text", text);
  } else {
    const encodedLocation = encodeLeboncoinWebLocation(location);
    if (encodedLocation) {
      params.set("locations", encodedLocation);
    } else {
      const text = resolveLeboncoinSearchText(location);
      if (text) params.set("text", text);
    }
  }

  if (criteria.maxPrice !== undefined) {
    params.set("price", `0-${String(criteria.maxPrice)}`);
  }
  if (criteria.minSurface !== undefined) {
    params.set("square", `${String(criteria.minSurface)}-max`);
  }
  if (criteria.minLandSurface !== undefined) {
    params.set("land_plot_surface", `${String(criteria.minLandSurface)}-max`);
  }
  if (criteria.minRooms !== undefined) {
    params.set("rooms", `${String(criteria.minRooms)}-max`);
  }
  if (criteria.minBedrooms !== undefined) {
    params.set("bedrooms", `${String(criteria.minBedrooms)}-max`);
  }
  if (criteria.ancienOnly) {
    params.set("immo_sell_type", "old");
  }
  if (page > 1) {
    params.set("page", String(page));
  }

  return `${SEARCH_BASE}?${params.toString()}`;
}
