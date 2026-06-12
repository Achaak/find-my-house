export function parseClassifiedLandSurface(text: string): number | null {
  const match =
    /terrain\s*(?:de\s+)?(\d[\d\s]*)\s*m²/i.exec(text) ??
    /(\d[\d\s]*)\s*m²\s*(?:de\s+)?terrain/i.exec(text);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
