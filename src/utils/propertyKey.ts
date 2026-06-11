import { createHash } from "node:crypto";
import type { Listing } from "../types/listing.js";

export type PropertyKeyInput = Pick<
  Listing,
  | "postalCode"
  | "price"
  | "surface"
  | "rooms"
  | "bedrooms"
  | "landSurface"
  | "propertyType"
  | "isNewProperty"
>;

function normalizePropertyType(propertyType: string | null): string {
  if (!propertyType) return "";
  return propertyType.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatSurface(surface: number | null): string {
  return surface !== null ? surface.toFixed(1) : "";
}

function formatBoolean(value: boolean | null): string {
  if (value === null) return "";
  return value ? "1" : "0";
}

/**
 * Property fingerprint for cross-site deduplication.
 * Uses structural attributes stable across portals, plus property type,
 * land surface and new/ancien flag to reduce false merges.
 */
export function computePropertyKey(listing: PropertyKeyInput): string {
  const parts = [
    listing.postalCode ?? "",
    String(listing.price),
    formatSurface(listing.surface),
    listing.rooms !== null ? String(listing.rooms) : "",
    listing.bedrooms !== null ? String(listing.bedrooms) : "",
    normalizePropertyType(listing.propertyType),
    formatSurface(listing.landSurface),
    formatBoolean(listing.isNewProperty),
  ];

  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32);
}
