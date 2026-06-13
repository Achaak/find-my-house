import type {
  ClassifiedCard,
  ClassifiedPortalConfig,
  ClassifiedPricing,
} from "./types.js";

export function parseClassifiedPrice(pricing?: ClassifiedPricing): number {
  const raw = pricing?.rawPrice;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseClassifiedRooms(card: ClassifiedCard): number | null {
  if (card.rooms !== undefined) return card.rooms;

  const tag = card.tags?.find((t) => /\d+\s*pièces?\b/i.test(t));
  if (!tag) return null;

  const match = /(\d+)\s*pièces?\b/i.exec(tag);
  return match ? Number(match[1]) : null;
}

export function parseClassifiedBedrooms(card: ClassifiedCard): number | null {
  if (card.bedroomCount !== undefined) return card.bedroomCount;

  const tag = card.tags?.find((t) => /\d+\s*chambres?\b/i.test(t));
  if (!tag) return null;

  const match = /(\d+)\s*chambres?\b/i.exec(tag);
  return match ? Number(match[1]) : null;
}

export function buildClassifiedListingUrl(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard
): string {
  if (!card.classifiedURL) {
    return `${portal.baseUrl}/annonces/achat/maison/${String(card.id)}.htm`;
  }

  if (card.classifiedURL.startsWith("http")) return card.classifiedURL;
  return `${portal.baseUrl}${card.classifiedURL}`;
}

/** Fallback MMS host when only a relative photo path is available. */
export const AVIV_MMS_BASE_URL = "https://mms.seloger.com";

export function classifiedImageNeedsRefresh(
  imageUrl: string | null | undefined
): boolean {
  if (!imageUrl) return true;
  if (imageUrl.includes("v.seloger.com/s/width/")) return true;

  try {
    const { hostname, search } = new URL(imageUrl);
    if (
      (hostname === "mms.logic-immo.com" || hostname === "mms.seloger.com") &&
      !search.includes("ci_seal=")
    ) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

export function normalizeAvivImageUrl(imageUrl: string): string {
  return imageUrl;
}

export function buildClassifiedImageUrl(
  portal: ClassifiedPortalConfig,
  photoPath?: string
): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("http")) return photoPath;

  const path = photoPath.startsWith("/") ? photoPath : `/${photoPath}`;
  return `${portal.imageBaseUrl}${path}`;
}
