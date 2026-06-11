import { createHash } from "node:crypto";
import type { Listing } from "../types/listing.js";

/**
 * Empreinte d'un bien pour la déduplication inter-sites.
 * Basée uniquement sur les caractéristiques structurelles stables entre portails
 * (le GPS et le titre varient trop ; le terrain est souvent absent sur SeLoger).
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
