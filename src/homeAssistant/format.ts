import type { CompatibilityCard } from "../types/compatibility.js";
import type { PropertyRow } from "../types/listing.js";
import { formatSourceLabel } from "../utils/listing/sourceLabel.js";
import { formatEnergyClasses } from "../utils/energy/energyClass.js";
import { formatCompatibilityFieldValue } from "../utils/compatibility/present.js";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatPriceDrop(property: PropertyRow): string | null {
  if (property.price >= property.firstPrice) return null;

  const drop = property.firstPrice - property.price;
  const pct = Math.round((drop / property.firstPrice) * 100);
  return `Baisse : ${formatPrice(property.firstPrice)} → ${formatPrice(property.price)} (−${formatPrice(drop)}, −${String(pct)} %)`;
}

function formatSources(property: PropertyRow): string {
  const sources = [...new Set(property.publications.map((p) => p.source))];
  if (sources.length === 0) {
    return formatSourceLabel(property.source);
  }
  return sources.map(formatSourceLabel).join(", ");
}

function formatLocation(property: PropertyRow): string {
  return `${property.city}${property.postalCode ? ` (${property.postalCode})` : ""}`;
}

function formatSpecs(property: PropertyRow): string | null {
  const parts: string[] = [];

  if (property.surface) {
    parts.push(`${String(property.surface)} m²`);
  }
  if (property.landSurface) {
    parts.push(`terrain ${String(property.landSurface)} m²`);
  }
  if (property.rooms) {
    parts.push(`${String(property.rooms)} pièces`);
  }
  if (property.bedrooms) {
    parts.push(`${String(property.bedrooms)} ch.`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatPropertyNotification(
  property: PropertyRow,
  options?: {
    compatibility?: CompatibilityCard;
    header?: string;
    priceDrop?: boolean;
  }
): { title: string; message: string; url?: string } {
  const lines: string[] = [];

  if (options?.header) {
    lines.push(options.header);
    lines.push("");
  }

  lines.push(`${formatPrice(property.price)} · ${formatLocation(property)}`);

  const specs = formatSpecs(property);
  if (specs) {
    lines.push(specs);
  }

  const energy = formatEnergyClasses(property.dpeClass, property.gesClass);
  if (energy) {
    lines.push(`DPE ${energy}`);
  }

  if (options?.compatibility) {
    const compatibility = formatCompatibilityFieldValue(options.compatibility);
    if (compatibility) {
      lines.push(compatibility);
    }
  }

  if (options?.priceDrop) {
    const drop = formatPriceDrop(property);
    if (drop) {
      lines.push(drop);
    }
  }

  lines.push(formatSources(property));
  lines.push(property.url);

  return {
    title: property.title,
    message: lines.join("\n"),
    url: property.url,
  };
}
