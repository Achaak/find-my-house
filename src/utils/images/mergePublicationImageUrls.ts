import { normalizeImageUrlForDedup } from "./normalizeImageUrl.js";

export function mergePublicationImageUrls(
  existing: string[] | null | undefined,
  incoming: string[] | null | undefined
): string[] | null {
  const merged = [...(existing ?? []), ...(incoming ?? [])];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const url of merged) {
    const trimmed = url.trim();
    if (!trimmed) continue;
    const key = normalizeImageUrlForDedup(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result.length > 0 ? result : null;
}
