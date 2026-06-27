import { withBasePath } from "@/lib/base-path";
import { hasPriceDrop } from "@/lib/price-drop";
import { buildPropertySummary } from "@/lib/property-summary";
import type { Property } from "@find-my-house/api-types";
import { formatPrice, formatSource } from "@/lib/utils";
import * as m from "@/paraglide/messages.js";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPriceShort(price: number): string {
  if (price >= 1_000_000) {
    const millions = price / 1_000_000;
    return `${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (price >= 1_000) {
    return `${Math.round(price / 1_000)}k`;
  }
  return String(price);
}

export type MarkerVariant = "liked" | "disliked" | "default";

export function getMarkerVariant(
  property: Pick<Property, "reaction">
): MarkerVariant {
  if (property.reaction === "like") return "liked";
  if (property.reaction === "dislike") return "disliked";
  return "default";
}

export function buildMarkerHtml(
  property: Property,
  options: { selected?: boolean } = {}
): string {
  const variant = getMarkerVariant(property);
  const priceDrop = hasPriceDrop(property);
  const selected = options.selected ?? false;
  const classes = [
    "fmh-map-marker",
    `fmh-map-marker--${variant}`,
    priceDrop ? "fmh-map-marker--price-drop" : "",
    selected ? "fmh-map-marker--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<div class="${classes}">${escapeHtml(formatPriceShort(property.price))}</div>`;
}

export function buildPopupHtml(property: Property): string {
  const summary = buildPropertySummary(property);
  const detailUrl = withBasePath(summary.detailPath);

  const imageBlock = property.imageUrl
    ? `<img class="fmh-map-popup__image" src="${escapeHtml(property.imageUrl)}" alt="" loading="lazy" />`
    : `<div class="fmh-map-popup__image fmh-map-popup__image--placeholder">${escapeHtml(m.property_no_photo())}</div>`;

  const badgeHtml = summary.badges
    .map((badge) => {
      switch (badge.kind) {
        case "id":
          return `<span class="fmh-map-popup__badge">#${String(badge.id)}</span>`;
        case "source":
          return `<span class="fmh-map-popup__badge">${escapeHtml(formatSource(badge.source))}</span>`;
        case "publications-unavailable":
          return `<span class="fmh-map-popup__badge">${escapeHtml(m.publications_unavailable_badge())}</span>`;
        case "compatibility":
          return `<span class="fmh-map-popup__badge">${escapeHtml(badge.label)}</span>`;
        case "price-drop":
          return `<span class="fmh-map-popup__drop">${escapeHtml(badge.label)}</span>`;
        case "reaction-like":
          return `<span class="fmh-map-popup__badge fmh-map-popup__badge--liked">${escapeHtml(m.reaction_liked())}</span>`;
        case "reaction-dislike":
          return `<span class="fmh-map-popup__badge fmh-map-popup__badge--disliked">${escapeHtml(m.reaction_disliked())}</span>`;
        default:
          return "";
      }
    })
    .join("");

  const firstPriceBlock =
    summary.priceDropLabel && summary.firstPrice > summary.price
      ? `<span class="fmh-map-popup__first-price">${escapeHtml(formatPrice(summary.firstPrice))}</span>`
      : "";

  const portalLinks = summary.portalPublications
    .map(
      (publication) =>
        `<a class="fmh-map-popup__btn" href="${escapeHtml(publication.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(formatSource(publication.source))} ↗</a>`
    )
    .join("");

  return `
    <div class="fmh-map-popup">
      ${imageBlock}
      <div class="fmh-map-popup__body">
        <div class="fmh-map-popup__badges">
          ${badgeHtml}
        </div>
        <p class="fmh-map-popup__title">${escapeHtml(summary.title)}</p>
        <p class="fmh-map-popup__location">${escapeHtml(summary.locationLine)}</p>
        <p class="fmh-map-popup__price">
          <strong>${escapeHtml(formatPrice(summary.price))}</strong>
          ${firstPriceBlock}
        </p>
        ${summary.specsLine ? `<p class="fmh-map-popup__specs">${escapeHtml(summary.specsLine)}</p>` : ""}
        <div class="fmh-map-popup__actions">
          <a class="fmh-map-popup__btn fmh-map-popup__btn--primary" href="${escapeHtml(detailUrl)}">${escapeHtml(m.property_details())}</a>
          ${portalLinks}
        </div>
      </div>
    </div>
  `;
}

export function isDarkMode(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    document.body.classList.contains("dark") ||
    document.querySelector(".dark") !== null
  );
}

export const MAP_TILE_URLS = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
} as const;

export const MAP_ATTRIBUTION = {
  light:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
} as const;

export function filterMappable(properties: Property[]): Property[] {
  return properties.filter(
    (property) => property.latitude !== null && property.longitude !== null
  );
}

export function googleMapsSearchUrl(options: {
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}): string {
  const { address, latitude, longitude } = options;
  if (latitude != null && longitude != null) {
    const query = `${String(latitude)},${String(longitude)}`;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
