import { normalizeImageUrlForDedup } from "./normalizeImageUrl.js";

/** URLs shared by this many distinct properties are treated as syndicated spam. */
export const SYNDICATED_PHOTO_MIN_PROPERTY_COUNT = 3;

export function photoUrlDedupKey(url: string): string {
  return normalizeImageUrlForDedup(url.trim());
}

export function filterSyndicatedPhotoUrls(
  urls: string[] | null | undefined,
  blockedUrlKeys: ReadonlySet<string>
): string[] | null {
  if (!urls?.length || blockedUrlKeys.size === 0) return urls ?? null;

  const filtered = urls.filter(
    (url) => !blockedUrlKeys.has(photoUrlDedupKey(url))
  );
  return filtered.length > 0 ? filtered : null;
}

export function firstPhotoUrl(
  urls: string[] | null | undefined
): string | null {
  return urls?.[0]?.trim() ?? null;
}
