import { formatCompatibilityBadge } from "@/lib/compatibility";
import { formatPriceDrop } from "@/lib/price-drop";
import {
  getDisplayPublications,
  type DisplayPublication,
} from "@/lib/publications";
import type { Property } from "@find-my-house/api-types";
import * as m from "@/paraglide/messages.js";

export type PropertySummaryBadge =
  | { kind: "id"; id: number }
  | { kind: "source"; source: DisplayPublication["source"] }
  | { kind: "publications-unavailable" }
  | { kind: "compatibility"; label: string }
  | { kind: "price-drop"; label: string }
  | { kind: "reaction-like" }
  | { kind: "reaction-dislike" };

export type PropertySummarySpec = {
  key: string;
  label: string;
};

export type PropertySummary = {
  badges: PropertySummaryBadge[];
  title: string;
  locationLine: string;
  price: number;
  firstPrice: number;
  priceDropLabel: string | null;
  specs: PropertySummarySpec[];
  specsLine: string;
  portalPublications: DisplayPublication[];
  detailPath: string;
};

export function buildPropertySummary(property: Property): PropertySummary {
  const portalPublications = getDisplayPublications(property);
  const priceDropLabel = formatPriceDrop(property);
  const locationLine = [
    property.city,
    property.postalCode ? `(${property.postalCode})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const badges: PropertySummaryBadge[] = [
    { kind: "id", id: property.id },
    ...(portalPublications.length > 0
      ? portalPublications.map(
          (publication) =>
            ({ kind: "source", source: publication.source }) as const
        )
      : [{ kind: "publications-unavailable" } as const]),
    ...(property.compatibility?.tier
      ? (() => {
          const label = formatCompatibilityBadge(property.compatibility);
          return label ? [{ kind: "compatibility" as const, label }] : [];
        })()
      : []),
    ...(property.reaction === "like"
      ? [{ kind: "reaction-like" as const }]
      : []),
    ...(property.reaction === "dislike"
      ? [{ kind: "reaction-dislike" as const }]
      : []),
    ...(priceDropLabel
      ? [{ kind: "price-drop" as const, label: priceDropLabel }]
      : []),
  ];

  const specs: PropertySummarySpec[] = [
    ...(property.surface
      ? [{ key: "surface", label: `${String(property.surface)} m²` }]
      : []),
    ...(property.landSurface
      ? [
          {
            key: "land",
            label: m.property_land_surface({ surface: property.landSurface }),
          },
        ]
      : []),
    ...(property.rooms
      ? [{ key: "rooms", label: m.property_rooms({ count: property.rooms }) }]
      : []),
    ...(property.bedrooms
      ? [
          {
            key: "bedrooms",
            label: m.property_beds({ count: property.bedrooms }),
          },
        ]
      : []),
  ];

  return {
    badges,
    title: property.title,
    locationLine,
    price: property.price,
    firstPrice: property.firstPrice,
    priceDropLabel,
    specs,
    specsLine: specs.map((spec) => spec.label).join(" · "),
    portalPublications,
    detailPath: `/listings/${String(property.id)}`,
  };
}
