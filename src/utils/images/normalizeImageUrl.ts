/** Strip query params and fragments for cross-portal URL deduplication. */
export function normalizeImageUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("#")[0]?.split("?")[0] ?? url;
  }
}
