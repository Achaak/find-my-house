/** Tolerance for DPE consumption matching (kWh/m²/an). */
export const CONSUMPTION_TOLERANCE_KWH = 2;

/** Tolerance for GES emission matching (kg CO₂/m²/an). */
export const EMISSION_TOLERANCE_KG = 1;

export type EnergyMetrics = {
  dpeConsumptionKwhM2: number | null;
  gesEmissionKgM2: number | null;
};

const EMPTY_METRICS: EnergyMetrics = {
  dpeConsumptionKwhM2: null,
  gesEmissionKgM2: null,
};

function parseMetric(value: string): number | null {
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Extract kWh/m² and kg CO₂/m² from listing text (description, HTML…). */
export function parseEnergyMetricsFromText(
  text: string | null | undefined
): EnergyMetrics {
  if (!text) return EMPTY_METRICS;

  const consoMatch =
    /consommation[^:]{0,40}:\s*(\d+(?:[.,]\d+)?)\s*kwh\s*\/\s*m²/i.exec(text) ??
    /(\d+(?:[.,]\d+)?)\s*kwh\s*\/\s*m²\s*(?:\.\s*an|\/\s*an)/i.exec(text);

  const emissionMatch =
    /émissions?\s*:\s*(\d+(?:[.,]\d+)?)\s*kg/i.exec(text) ??
    /(\d+(?:[.,]\d+)?)\s*kg\s*c[oO]₂?\s*\/\s*m²/i.exec(text);

  return {
    dpeConsumptionKwhM2: consoMatch ? parseMetric(consoMatch[1]) : null,
    gesEmissionKgM2: emissionMatch ? parseMetric(emissionMatch[1]) : null,
  };
}

export function mergeEnergyMetrics(
  ...sources: (EnergyMetrics | null | undefined)[]
): EnergyMetrics {
  let dpeConsumptionKwhM2: number | null = null;
  let gesEmissionKgM2: number | null = null;

  for (const source of sources) {
    if (!source) continue;
    dpeConsumptionKwhM2 ??= source.dpeConsumptionKwhM2;
    gesEmissionKgM2 ??= source.gesEmissionKgM2;
  }

  return { dpeConsumptionKwhM2, gesEmissionKgM2 };
}

export function buildConsumptionRange(
  consumption: number,
  tolerance = CONSUMPTION_TOLERANCE_KWH
): { min: number; max: number } {
  const rounded = Math.round(consumption);
  return {
    min: Math.max(0, rounded - tolerance),
    max: rounded + tolerance,
  };
}

export function buildEmissionRange(
  emission: number,
  tolerance = EMISSION_TOLERANCE_KG
): { min: number; max: number } {
  const rounded = Math.round(emission);
  return {
    min: Math.max(0, rounded - tolerance),
    max: rounded + tolerance,
  };
}
