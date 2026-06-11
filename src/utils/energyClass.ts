/** French energy label: A–G, plus N (non soumis) and V (vierge). */
export type EnergyClass = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "N" | "V";

const VALID_CLASSES = new Set<string>([
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "N",
  "V",
]);

export function normalizeEnergyClass(
  value: string | null | undefined
): EnergyClass | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const letter = trimmed.charAt(0).toUpperCase();
  return VALID_CLASSES.has(letter) ? (letter as EnergyClass) : null;
}

export function formatEnergyClasses(
  dpeClass: string | null | undefined,
  gesClass: string | null | undefined
): string | null {
  const dpe = dpeClass ? `DPE ${dpeClass}` : null;
  const ges = gesClass ? `GES ${gesClass}` : null;

  if (dpe && ges) return `${dpe} · ${ges}`;
  return dpe ?? ges;
}
