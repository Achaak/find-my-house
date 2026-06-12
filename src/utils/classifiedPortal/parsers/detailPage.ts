import type { ClassifiedData, ClassifiedListingDetails } from "../types.js";
import {
  parseClassifiedDetailCard,
  parseClassifiedLandSurface,
} from "./classifiedCard.js";
import {
  extractClassifiedCoordsFromData,
  parseClassifiedCoordinatesFromHtml,
} from "./coordinates.js";
import { parseEmbeddedWindowJson } from "./embeddedJson.js";
import { parseClassifiedDetailEnergy } from "./detailEnergy.js";

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

  return {
    ...energy,
    description: card?.description ?? null,
    surface: card?.surface ?? null,
    bedrooms: card?.bedroomCount ?? null,
    rooms: card?.rooms ?? null,
    landSurface: parseClassifiedLandSurface(text),
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}
