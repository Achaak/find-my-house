export function parseSeLogerEnergyClassesFromText(text: string): {
  dpeClass: string | null;
  gesClass: string | null;
} {
  const combinedMatch =
    /Classe énergie\s+([A-G])[\s,]+Classe climat\s+([A-G])/i.exec(text);
  if (combinedMatch) {
    return {
      dpeClass: combinedMatch[1].toUpperCase(),
      gesClass: combinedMatch[2].toUpperCase(),
    };
  }

  const dpeMatch = /(?:DPE|énergie)\s*[:\s]*([A-G])/i.exec(text);
  const gesMatch = /(?:GES|climat)\s*[:\s]*([A-G])/i.exec(text);

  return {
    dpeClass: dpeMatch?.[1]?.toUpperCase() ?? null,
    gesClass: gesMatch?.[1]?.toUpperCase() ?? null,
  };
}
