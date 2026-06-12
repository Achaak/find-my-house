export function normalizeHighlight(value: string): string {
  return value.trim().toLowerCase();
}

export function highlightsOverlapRatio(
  actual: string[] | null | undefined,
  preferred: string[] | null | undefined
): number | null {
  if (!preferred?.length) return null;

  const normalizedPreferred = preferred.map(normalizeHighlight);
  if (!actual?.length) return 0;

  const normalizedActual = actual.map(normalizeHighlight);
  const matches = normalizedPreferred.filter((preferredItem) =>
    normalizedActual.some(
      (actualItem) =>
        actualItem.includes(preferredItem) || preferredItem.includes(actualItem)
    )
  );

  return matches.length / normalizedPreferred.length;
}

export function collectPreferredHighlights(
  listings: { highlights: string[] | null }[]
): string[] | undefined {
  const counts = new Map<string, { label: string; count: number }>();

  for (const listing of listings) {
    const seen = new Set<string>();
    for (const highlight of listing.highlights ?? []) {
      const trimmed = highlight.trim();
      if (!trimmed) continue;

      const key = normalizeHighlight(trimmed);
      if (seen.has(key)) continue;
      seen.add(key);

      const current = counts.get(key);
      if (current) {
        current.count += 1;
      } else {
        counts.set(key, { label: trimmed, count: 1 });
      }
    }
  }

  if (counts.size === 0) return undefined;

  const threshold = listings.length >= 2 ? 2 : 1;
  const preferred = [...counts.values()]
    .filter((entry) => entry.count >= threshold)
    .map((entry) => entry.label);

  if (preferred.length > 0) return preferred;

  return [...counts.values()].map((entry) => entry.label);
}
