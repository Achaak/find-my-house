import {
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "../../energy/energyMetrics.js";
import type { ClassifiedEnergyDetails } from "../types.js";
import { parseClassifiedEnergyClassesFromText } from "./energyText.js";

function extractEscapedScaleRating(
  html: string,
  scaleType: string
): string | null {
  const idx = html.indexOf(scaleType);
  if (idx === -1) return null;

  const slice = html.slice(Math.max(0, idx - 300), idx);
  const ratings = [...slice.matchAll(/\\"rating\\":\\"([A-G])\\"/gi)];
  return ratings.at(-1)?.[1]?.toUpperCase() ?? null;
}

function parseClassifiedDetailMetrics(html: string) {
  const fromText = parseEnergyMetricsFromText(html);

  const energyScaleIdx = html.indexOf("FR_ENERGY_AFTER_2021");
  const ghgScaleIdx = html.indexOf("FR_GHG_AFTER_2021");

  const extractScaleValue = (scaleIdx: number): number | null => {
    if (scaleIdx === -1) return null;
    const slice = html.slice(scaleIdx, scaleIdx + 500);
    const match =
      /\\"value\\":\\"(\d+(?:[.,]\d+)?)\s*kWh\/m²/i.exec(slice) ??
      /\\"value\\":\\"(\d+(?:[.,]\d+)?)\s*kg CO₂\/m²/i.exec(slice);
    if (!match) return null;
    const parsed = Number(match[1].replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const consoFromScale =
    energyScaleIdx !== -1 ? extractScaleValue(energyScaleIdx) : null;
  const emissionFromScale =
    ghgScaleIdx !== -1 ? extractScaleValue(ghgScaleIdx) : null;

  return mergeEnergyMetrics(fromText, {
    dpeConsumptionKwhM2: consoFromScale,
    gesEmissionKgM2: emissionFromScale,
  });
}

export function parseClassifiedDetailEnergy(
  html: string
): ClassifiedEnergyDetails {
  const fromText = parseClassifiedEnergyClassesFromText(html);
  const classes: Pick<ClassifiedEnergyDetails, "dpeClass" | "gesClass"> =
    fromText.dpeClass && fromText.gesClass
      ? fromText
      : {
          dpeClass:
            fromText.dpeClass ??
            extractEscapedScaleRating(html, "FR_ENERGY_AFTER_2021"),
          gesClass:
            fromText.gesClass ??
            extractEscapedScaleRating(html, "FR_GHG_AFTER_2021"),
        };

  return { ...classes, ...parseClassifiedDetailMetrics(html) };
}
