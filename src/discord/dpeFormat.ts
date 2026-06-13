import type { PropertyRow } from "../types/listing.js";
import type { RankedDpeSearchResult } from "../utils/energy/dpePropertyMatch.js";
import { formatEnergyClasses } from "../utils/energy/energyClass.js";
import { formatPrice } from "./format.js";

const OBSERVATOIRE_URL =
  "https://observatoire-dpe-audit.ademe.fr/donnees-dpe-publiques";

function formatDate(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("fr-FR");
}

function formatPropertyContext(property: PropertyRow): string {
  const energyLabel = formatEnergyClasses(property.dpeClass, property.gesClass);

  return [
    `**#${String(property.id)}** — ${property.title}`,
    `💰 ${formatPrice(property.price)}`,
    [
      property.surface ? `${String(property.surface)} m²` : null,
      property.rooms ? `${String(property.rooms)} rooms` : null,
      property.bedrooms ? `${String(property.bedrooms)} ch.` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    energyLabel ? `⚡ ${energyLabel}` : null,
    `📍 ${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
    property.address ? `🏠 Current address: **${property.address}**` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatCandidate(index: number, result: RankedDpeSearchResult): string {
  const energyLabel = formatEnergyClasses(result.dpeClass, result.gesClass);
  const establishmentDate = formatDate(result.establishmentDate);

  return [
    `**${String(index)}.** ${result.address}`,
    energyLabel ? `⚡ ${energyLabel}` : null,
    [
      result.surfaceM2 ? `📐 ${String(result.surfaceM2)} m²` : null,
      result.consumptionKwhM2Year
        ? `⚡ ${String(result.consumptionKwhM2Year)} kWh/m²/an`
        : null,
      result.emissionGesKgM2Year
        ? `🌍 ${String(result.emissionGesKgM2Year)} kg CO₂/m²/an`
        : null,
      result.buildingType ?? null,
      establishmentDate ? `📅 ${establishmentDate}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    `_DPE ${result.numeroDpe} · score ${String(Math.round(result.matchScore))}_`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatDpePropertySearchReply(
  property: PropertyRow,
  query: string,
  candidates: RankedDpeSearchResult[]
): string {
  if (candidates.length === 0) {
    return [
      formatPropertyContext(property),
      "",
      `No candidate address found via ADEME for **${query}**.`,
      "",
      "Criteria: department, DPE, GES, consumption/emissions, surface ±10%. Location is a ranking bonus.",
      `[ADEME public DPE data](${OBSERVATOIRE_URL})`,
    ].join("\n");
  }

  return [
    formatPropertyContext(property),
    "",
    `ADEME search: **${query}**`,
    "",
    "Check on Google Maps (🗺️), then confirm the address (✅):",
    "",
    candidates
      .map((candidate, index) => formatCandidate(index + 1, candidate))
      .join("\n\n"),
    "",
    `[ADEME public DPE data](${OBSERVATOIRE_URL})`,
  ].join("\n");
}
