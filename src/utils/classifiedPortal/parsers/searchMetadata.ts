import { parseEnergyMetricsFromText } from "../../energy/energyMetrics.js";
import type { ClassifiedCard } from "../types.js";
import { parseClassifiedEnergyClassesFromText } from "./energyText.js";

/** Applies DPE/GES hints available on search cards (no detail page). */
export function applyClassifiedSearchMetadata(
  card: ClassifiedCard
): ClassifiedCard {
  const text = [card.description, ...(card.tags ?? [])]
    .filter(Boolean)
    .join("\n");
  if (!text) return card;

  const parsed = parseClassifiedEnergyClassesFromText(text);
  const metrics = parseEnergyMetricsFromText(text);

  return {
    ...card,
    energyClass: card.energyClass ?? parsed.dpeClass ?? undefined,
    gesClass: card.gesClass ?? parsed.gesClass ?? undefined,
    dpeConsumptionKwhM2:
      card.dpeConsumptionKwhM2 ?? metrics.dpeConsumptionKwhM2 ?? undefined,
    gesEmissionKgM2:
      card.gesEmissionKgM2 ?? metrics.gesEmissionKgM2 ?? undefined,
  };
}
