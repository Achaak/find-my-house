import type { ListingSource } from "@find-my-house/api-types";
import type { ListingPublication } from "../generated/prisma/client.js";
import { mergeHighlights } from "../utils/listing/amenities.js";

const SOURCE_PRIORITY: ListingSource[] = [
  "bienici",
  "seloger",
  "logicimmo",
  "leboncoin",
];

type PublicationLike = Pick<
  ListingPublication,
  | "id"
  | "source"
  | "isActive"
  | "scrapedAt"
  | "title"
  | "price"
  | "surface"
  | "landSurface"
  | "rooms"
  | "bedrooms"
  | "isNewProperty"
  | "latitude"
  | "longitude"
  | "city"
  | "postalCode"
  | "address"
  | "dpeNumero"
  | "description"
  | "imageUrl"
  | "propertyType"
  | "dpeClass"
  | "gesClass"
  | "dpeConsumptionKwhM2"
  | "gesEmissionKgM2"
  | "bathrooms"
  | "constructionYear"
  | "heating"
  | "orientation"
  | "propertyCondition"
  | "parkingSpaces"
  | "highlights"
>;

export type PropertyProjection = {
  title: string;
  price: number;
  surface: number | null;
  landSurface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  isNewProperty: boolean | null;
  latitude: number | null;
  longitude: number | null;
  city: string;
  postalCode: string | null;
  address: string | null;
  dpeNumero: string | null;
  description: string | null;
  imageUrl: string | null;
  propertyType: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  dpeConsumptionKwhM2: number | null;
  gesEmissionKgM2: number | null;
  bathrooms: number | null;
  constructionYear: number | null;
  heating: string | null;
  orientation: string | null;
  propertyCondition: string | null;
  parkingSpaces: number | null;
  highlights: string[] | null;
};

function getSourceRank(source: ListingSource): number {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}

function sortForProjection(
  publications: readonly PublicationLike[]
): PublicationLike[] {
  return [...publications].sort((a, b) => {
    const rankDelta = getSourceRank(a.source) - getSourceRank(b.source);
    if (rankDelta !== 0) return rankDelta;
    return b.scrapedAt.getTime() - a.scrapedAt.getTime();
  });
}

export function selectProjectionPublications(
  publications: readonly PublicationLike[]
): PublicationLike[] {
  const active = publications.filter((publication) => publication.isActive);
  return sortForProjection(active.length > 0 ? active : publications);
}

export function computePropertyProjection(
  publications: readonly PublicationLike[]
): PropertyProjection | null {
  if (publications.length === 0) return null;
  const ordered = selectProjectionPublications(publications);
  const primary = ordered[0];
  const mergedHighlights = mergeHighlights(
    ...ordered.map((publication) =>
      Array.isArray(publication.highlights)
        ? publication.highlights.filter(
            (item): item is string => typeof item === "string"
          )
        : null
    )
  );

  const pick = <T>(
    selector: (publication: PublicationLike) => T | null
  ): T | null => {
    for (const publication of ordered) {
      const value = selector(publication);
      if (value !== null) return value;
    }
    return null;
  };

  return {
    title: primary.title,
    price: primary.price,
    surface: pick((publication) => publication.surface),
    landSurface: pick((publication) => publication.landSurface),
    rooms: pick((publication) => publication.rooms),
    bedrooms: pick((publication) => publication.bedrooms),
    isNewProperty: pick((publication) => publication.isNewProperty),
    latitude: pick((publication) => publication.latitude),
    longitude: pick((publication) => publication.longitude),
    city: primary.city,
    postalCode: pick((publication) => publication.postalCode),
    address: pick((publication) => publication.address),
    dpeNumero: pick((publication) => publication.dpeNumero),
    description: pick((publication) => publication.description),
    imageUrl: pick((publication) => publication.imageUrl),
    propertyType: pick((publication) => publication.propertyType),
    dpeClass: pick((publication) => publication.dpeClass),
    gesClass: pick((publication) => publication.gesClass),
    dpeConsumptionKwhM2: pick((publication) => publication.dpeConsumptionKwhM2),
    gesEmissionKgM2: pick((publication) => publication.gesEmissionKgM2),
    bathrooms: pick((publication) => publication.bathrooms),
    constructionYear: pick((publication) => publication.constructionYear),
    heating: pick((publication) => publication.heating),
    orientation: pick((publication) => publication.orientation),
    propertyCondition: pick((publication) => publication.propertyCondition),
    parkingSpaces: pick((publication) => publication.parkingSpaces),
    highlights: mergedHighlights,
  };
}
