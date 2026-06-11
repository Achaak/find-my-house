import type { PropertyRow } from "../types/listing.js";
import type { RankedDpeSearchResult } from "../utils/dpePropertyMatch.js";
import { formatEnergyClasses } from "../utils/energyClass.js";
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
      property.rooms ? `${String(property.rooms)} pièces` : null,
      property.bedrooms ? `${String(property.bedrooms)} ch.` : null,
    ]
      .filter(Boolean)
      .join(" · ") || null,
    energyLabel ? `⚡ ${energyLabel}` : null,
    `📍 ${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`,
    property.address ? `🏠 Adresse actuelle : **${property.address}**` : null,
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
      `Aucune adresse candidate trouvée via l'ADEME pour **${query}**.`,
      "",
      "Les critères disponibles (ville, CP, surface, DPE, coordonnées) n'ont pas permis de proposer d'adresse fiable.",
      `[Données DPE publiques ADEME](${OBSERVATOIRE_URL})`,
    ].join("\n");
  }

  return [
    formatPropertyContext(property),
    "",
    `Recherche ADEME : **${query}**`,
    "",
    "Sélectionnez l'adresse correspondante :",
    "",
    candidates
      .map((candidate, index) => formatCandidate(index + 1, candidate))
      .join("\n\n"),
    "",
    `[Données DPE publiques ADEME](${OBSERVATOIRE_URL})`,
  ].join("\n");
}
