import { BASE_URL, IMAGE_BASE_URL } from "./types.js";
import type { SeLogerClassifiedCard, SeLogerPricing } from "./types.js";

export function parseSeLogerPrice(pricing?: SeLogerPricing): number {
  const raw = pricing?.rawPrice;
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseSeLogerBedrooms(
  card: SeLogerClassifiedCard
): number | null {
  if (card.bedroomCount !== undefined) return card.bedroomCount;

  const tag = card.tags?.find((t) => /\d+\s*chambre/i.test(t));
  if (!tag) return null;

  const match = /(\d+)/.exec(tag);
  return match ? Number(match[1]) : null;
}

export function buildSeLogerListingUrl(card: SeLogerClassifiedCard): string {
  if (!card.classifiedURL) {
    return `${BASE_URL}/annonces/achat/maison/${String(card.id)}.htm`;
  }

  if (card.classifiedURL.startsWith("http")) return card.classifiedURL;
  return `${BASE_URL}${card.classifiedURL}`;
}

export function buildSeLogerImageUrl(photoPath?: string): string | null {
  if (!photoPath) return null;
  if (photoPath.startsWith("http")) return photoPath;
  return `${IMAGE_BASE_URL}${photoPath}`;
}
