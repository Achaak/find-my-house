import { describe, expect, it } from "vitest";
import {
  buildConsumptionRange,
  buildEmissionRange,
  mergeEnergyMetrics,
  parseEnergyMetricsFromText,
} from "./energyMetrics.js";

describe("parseEnergyMetricsFromText", () => {
  it("returns empty metrics for missing text", () => {
    expect(parseEnergyMetricsFromText(null)).toEqual({
      dpeConsumptionKwhM2: null,
      gesEmissionKgM2: null,
    });
  });

  it("parses labelled French DPE/GES lines", () => {
    const text =
      "Consommation énergétique : 185 kWh/m².an\nÉmissions : 42 kg CO₂/m²";

    expect(parseEnergyMetricsFromText(text)).toEqual({
      dpeConsumptionKwhM2: 185,
      gesEmissionKgM2: 42,
    });
  });

  it("parses compact kWh/m² and kg CO₂/m² patterns", () => {
    const text = "Performance: 120 kWh/m²/an et 18 kg CO₂/m²";

    expect(parseEnergyMetricsFromText(text)).toEqual({
      dpeConsumptionKwhM2: 120,
      gesEmissionKgM2: 18,
    });
  });
});

describe("mergeEnergyMetrics", () => {
  it("keeps the first non-null value per field", () => {
    expect(
      mergeEnergyMetrics(
        { dpeConsumptionKwhM2: 100, gesEmissionKgM2: null },
        { dpeConsumptionKwhM2: 200, gesEmissionKgM2: 30 }
      )
    ).toEqual({
      dpeConsumptionKwhM2: 100,
      gesEmissionKgM2: 30,
    });
  });
});

describe("buildConsumptionRange", () => {
  it("builds a symmetric tolerance window", () => {
    expect(buildConsumptionRange(185)).toEqual({ min: 183, max: 187 });
  });
});

describe("buildEmissionRange", () => {
  it("builds a symmetric tolerance window", () => {
    expect(buildEmissionRange(42)).toEqual({ min: 41, max: 43 });
  });
});
