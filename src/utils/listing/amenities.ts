export function highlightsSetsEqual(
  left: string[] | null | undefined,
  right: string[] | null | undefined
): boolean {
  const a = new Set(left ?? []);
  const b = new Set(right ?? []);
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}

export function mergeHighlights(
  ...lists: (string[] | null | undefined)[]
): string[] | null {
  const merged = new Set<string>();

  for (const list of lists) {
    if (!list) continue;
    for (const item of list) {
      const trimmed = item.trim();
      if (trimmed) merged.add(trimmed);
    }
  }

  return merged.size > 0 ? [...merged] : null;
}

export function isStructuralTag(tag: string): boolean {
  return (
    /\d+\s*pièces?\b/i.test(tag) ||
    /\d+\s*chambres?\b/i.test(tag) ||
    /terrain\s*(?:de\s+)?\d/i.test(tag) ||
    /^\d+\s*m²\b/i.test(tag) ||
    /classe\s+(?:énergie|climat)/i.test(tag)
  );
}

export function highlightsFromTags(
  tags: string[] | undefined
): string[] | null {
  if (!tags?.length) return null;

  const filtered = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0 && !isStructuralTag(tag));

  return filtered.length > 0 ? filtered : null;
}

export function parseConstructionYearFromText(text: string): number | null {
  const match = /\b(18[89]\d|19\d{2}|20[0-2]\d)\b/.exec(text);
  if (!match) return null;

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

export function parseBathroomsFromTags(
  tags: string[] | undefined
): number | null {
  if (!tags?.length) return null;

  for (const tag of tags) {
    const match =
      /(\d+)\s*(?:salle(?:s)?\s*de\s*bains?|sdb)\b/i.exec(tag) ??
      /(\d+)\s*salle(?:s)?\s*d['']eau/i.exec(tag);
    if (match) return Number(match[1]);
  }

  return null;
}

export function parsePositiveInt(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

const MIN_CONSTRUCTION_YEAR = 1800;
const MAX_CONSTRUCTION_YEAR = 2100;

export function sanitizePositiveNumber(
  value: number | null | undefined
): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function sanitizePositiveInt(
  value: number | null | undefined
): number | null {
  const sanitized = sanitizePositiveNumber(value);
  return sanitized === null ? null : Math.round(sanitized);
}

export function sanitizeConstructionYear(
  value: number | null | undefined
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const year = Math.round(value);
  if (year < MIN_CONSTRUCTION_YEAR || year > MAX_CONSTRUCTION_YEAR) return null;
  return year;
}

export function parseConstructionYear(
  value: string | undefined
): number | null {
  return sanitizeConstructionYear(parsePositiveInt(value));
}
