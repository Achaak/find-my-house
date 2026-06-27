import type { ClassifiedData, ClassifiedListingDetails } from "../types.js";
import { pickLongestDescription } from "../../../domain/descriptionEquivalence.js";
import { extractClassifiedListingExtras } from "../extras.js";
import { parseClassifiedBedrooms, parseClassifiedRooms } from "../helpers.js";
import { parseConstructionYearFromText } from "../../listing/amenities.js";
import {
  extractClassifiedGalleryPhotos,
  parseClassifiedDetailCard,
  parseClassifiedLandSurface,
} from "./classifiedCard.js";
import {
  extractClassifiedCoordsFromData,
  parseClassifiedCoordinatesFromHtml,
} from "./coordinates.js";
import { parseEmbeddedWindowJson } from "./embeddedJson.js";
import { parseClassifiedDetailEnergy } from "./detailEnergy.js";
import { extractClassifiedMainDescriptionFromHtml } from "./detailDescription.js";
import { parseClassifiedOgImageFromHtml } from "./ogImage.js";
import { syncListingImageFields } from "../../images/scrapeImageUrls.js";

function extractClassifiedDataFromDetailHtml(
  html: string
): ClassifiedData | null {
  const fetcher = parseEmbeddedWindowJson("__UFRN_FETCHER__", html) as {
    data?: Record<string, { pageProps?: { classifiedData?: ClassifiedData } }>;
  } | null;

  return (
    fetcher?.data?.["classified-detail-init-data"]?.pageProps?.classifiedData ??
    (
      parseEmbeddedWindowJson("initialData", html) as {
        classified?: ClassifiedData;
      } | null
    )?.classified ??
    null
  );
}

export function parseClassifiedDetailPage(
  html: string
): ClassifiedListingDetails {
  const energy = parseClassifiedDetailEnergy(html);
  const card = parseClassifiedDetailCard(html, parseEmbeddedWindowJson);
  const text = [card?.description, ...(card?.tags ?? []), html]
    .filter(Boolean)
    .join("\n");

  const classifiedData = extractClassifiedDataFromDetailHtml(html);
  const coords =
    (classifiedData ? extractClassifiedCoordsFromData(classifiedData) : null) ??
    parseClassifiedCoordinatesFromHtml(html);
  const extras = card ? extractClassifiedListingExtras(card) : null;
  const galleryUrls = classifiedData
    ? extractClassifiedGalleryPhotos(classifiedData.gallery)
    : (card?.photos ?? null);
  const images = syncListingImageFields(
    galleryUrls?.length ? galleryUrls : null
  );
  const fallbackImageUrl =
    images.imageUrl ?? parseClassifiedOgImageFromHtml(html);

  const fallbackDescription = extractClassifiedMainDescriptionFromHtml(html);

  return {
    ...energy,
    description: pickLongestDescription([
      card?.description,
      fallbackDescription,
    ]),
    surface: card?.surface ?? null,
    bedrooms: card ? parseClassifiedBedrooms(card) : null,
    rooms: card ? parseClassifiedRooms(card) : null,
    landSurface: parseClassifiedLandSurface(text),
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    imageUrl: fallbackImageUrl,
    imageUrls:
      images.imageUrls ?? (fallbackImageUrl ? [fallbackImageUrl] : null),
    bathrooms: extras?.bathrooms ?? null,
    constructionYear:
      extras?.constructionYear ?? parseConstructionYearFromText(text),
    heating: extras?.heating ?? null,
    orientation: extras?.orientation ?? null,
    propertyCondition: extras?.propertyCondition ?? null,
    parkingSpaces: extras?.parkingSpaces ?? null,
    highlights: extras?.highlights ?? null,
  };
}
