import { withBasePath } from "@/lib/base-path";
import { formatPriceDrop, hasPriceDrop } from "@/lib/price-drop";
import { getDisplayPublications } from "@/lib/publications";
import { formatCompatibilityBadge } from "@/lib/compatibility";
import type { Property } from "@find-my-house/api-types";
import { formatPrice, formatSource } from "@/lib/utils";

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
  const detailUrl = withBasePath(`/listings/${String(property.id)}`);
  const priceDrop = formatPriceDrop(property);
  const location = [
    property.city,
    property.postalCode ? `(${property.postalCode})` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const specs = [
    property.surface ? `${String(property.surface)} m²` : null,
    property.rooms ? `${String(property.rooms)} rooms` : null,
    property.bedrooms ? `${String(property.bedrooms)} beds` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const imageBlock = property.imageUrl
    ? `<img class="fmh-map-popup__image" src="${escapeHtml(property.imageUrl)}" alt="" loading="lazy" />`
    : `<div class="fmh-map-popup__image fmh-map-popup__image--placeholder">No photo</div>`;

  const priceDropBlock = priceDrop
    ? `<span class="fmh-map-popup__drop">${escapeHtml(priceDrop)}</span>`
    : "";

  const firstPriceBlock =
    priceDrop && property.firstPrice > property.price
      ? `<span class="fmh-map-popup__first-price">${escapeHtml(formatPrice(property.firstPrice))}</span>`
      : "";

  const compatLabel = property.compatibility?.tier
    ? formatCompatibilityBadge(property.compatibility)
    : null;
  const compatBlock = compatLabel
    ? `<span class="fmh-map-popup__badge">${escapeHtml(compatLabel)}</span>`
    : "";

  const reactionBlock =
    property.reaction === "like"
      ? `<span class="fmh-map-popup__badge fmh-map-popup__badge--liked">Liked</span>`
      : property.reaction === "dislike"
        ? `<span class="fmh-map-popup__badge fmh-map-popup__badge--disliked">Disliked</span>`
        : "";

  const portalPublications = getDisplayPublications(property);
  const sourceBadges = portalPublications
    .map(
      (publication) =>
        `<span class="fmh-map-popup__badge">${escapeHtml(formatSource(publication.source))}</span>`
    )
    .join("");

  const portalLinks = portalPublications
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
          <span class="fmh-map-popup__badge">#${String(property.id)}</span>
          ${sourceBadges}
          ${compatBlock}
          ${reactionBlock}
          ${priceDropBlock}
        </div>
        <p class="fmh-map-popup__title">${escapeHtml(property.title)}</p>
        <p class="fmh-map-popup__location">${escapeHtml(location)}</p>
        <p class="fmh-map-popup__price">
          <strong>${escapeHtml(formatPrice(property.price))}</strong>
          ${firstPriceBlock}
        </p>
        ${specs ? `<p class="fmh-map-popup__specs">${escapeHtml(specs)}</p>` : ""}
        <div class="fmh-map-popup__actions">
          <a class="fmh-map-popup__btn fmh-map-popup__btn--primary" href="${escapeHtml(detailUrl)}">Details</a>
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
