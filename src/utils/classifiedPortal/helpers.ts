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

export function parseClassifiedBedrooms(card: ClassifiedCard): number | null {
  if (card.bedroomCount !== undefined) return card.bedroomCount;

  const tag = card.tags?.find((t) => /\d+\s*chambre/i.test(t));
  if (!tag) return null;

  const match = /(\d+)/.exec(tag);
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

export function buildClassifiedImageUrl(
  portal: ClassifiedPortalConfig,
  photoPath?: string
): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("http")) return photoPath;
  return `${portal.imageBaseUrl}${photoPath}`;
}
