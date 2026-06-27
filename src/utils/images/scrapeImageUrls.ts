import type { BienIciAd } from "../bienici/mapper.js";
import { buildClassifiedImageUrl } from "../classifiedPortal/helpers.js";
import type {
  ClassifiedCard,
  ClassifiedPortalConfig,
} from "../classifiedPortal/types.js";
import type { LeboncoinAd } from "../leboncoin/client.js";

function trimUrls(urls: string[]): string[] {
  return urls.map((url) => url.trim()).filter(Boolean);
}

export function bienIciScrapeImageUrls(ad: BienIciAd): string[] | null {
  const urls = trimUrls(ad.photos?.map((entry) => entry.url_photo) ?? []);
  return urls.length > 0 ? urls : null;
}

export function bienIciScrapeImageUrl(ad: BienIciAd): string | null {
  return bienIciScrapeImageUrls(ad)?.[0] ?? null;
}

export function leboncoinScrapeImageUrls(ad: LeboncoinAd): string[] | null {
  const images = ad.images;
  if (!images) return null;

  const fromLarge = trimUrls(images.urls_large ?? []);
  if (fromLarge.length > 0) return fromLarge;

  const fromStandard = trimUrls(images.urls ?? []);
  if (fromStandard.length > 0) return fromStandard;

  const thumb = images.thumb_url?.trim();
  return thumb ? [thumb] : null;
}

export function leboncoinScrapeImageUrl(ad: LeboncoinAd): string | null {
  return leboncoinScrapeImageUrls(ad)?.[0] ?? null;
}

export function classifiedScrapeImageUrls(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard
): string[] | null {
  const urls = trimUrls(
    (card.photos ?? [])
      .map((photo) => buildClassifiedImageUrl(portal, photo))
      .filter((url): url is string => Boolean(url))
  );
  return urls.length > 0 ? urls : null;
}

export function classifiedScrapeImageUrl(
  portal: ClassifiedPortalConfig,
  card: ClassifiedCard
): string | null {
  return classifiedScrapeImageUrls(portal, card)?.[0] ?? null;
}

export function syncListingImageFields(imageUrls: string[] | null): {
  imageUrls: string[] | null;
  imageUrl: string | null;
} {
  if (!imageUrls || imageUrls.length === 0) {
    return { imageUrls: null, imageUrl: null };
  }
  return { imageUrls, imageUrl: imageUrls[0] ?? null };
}
