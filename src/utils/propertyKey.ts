import { createHash } from "node:crypto";
import type { Listing } from "../types/listing.js";

/**
 * Property fingerprint for cross-site deduplication.
 * Based only on structural attributes stable across portals
 * (GPS and title vary too much; land area is often missing on SeLoger).
 */
export function computePropertyKey(
  listing: Pick<
    Listing,
    "postalCode" | "price" | "surface" | "rooms" | "bedrooms"
  >
): string {
  const parts = [
    listing.postalCode ?? "",
    String(listing.price),
    listing.surface !== null ? listing.surface.toFixed(1) : "",
    listing.rooms !== null ? String(listing.rooms) : "",
    listing.bedrooms !== null ? String(listing.bedrooms) : "",
  ];

  return createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 32);
}
