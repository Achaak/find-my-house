import type { SeLogerClassifiedData, SeLogerListingDetails } from "../types.js";
import {
  parseSeLogerDetailCard,
  parseSeLogerLandSurface,
} from "./classifiedCard.js";
import {
  extractSeLogerCoordsFromClassifiedData,
  parseSeLogerCoordinatesFromHtml,
} from "./coordinates.js";
import { parseEmbeddedWindowJson } from "./embeddedJson.js";
import { parseSeLogerDetailEnergy } from "./detailEnergy.js";

function extractClassifiedDataFromDetailHtml(
  html: string
): SeLogerClassifiedData | null {
  const fetcher = parseEmbeddedWindowJson("__UFRN_FETCHER__", html) as {
    data?: Record<
      string,
      { pageProps?: { classifiedData?: SeLogerClassifiedData } }
    >;
  } | null;

  return (
    fetcher?.data?.["classified-detail-init-data"]?.pageProps?.classifiedData ??
    (
      parseEmbeddedWindowJson("initialData", html) as {
        classified?: SeLogerClassifiedData;
      } | null
    )?.classified ??
    null
  );
}

export function parseSeLogerDetailPage(html: string): SeLogerListingDetails {
  const energy = parseSeLogerDetailEnergy(html);
  const card = parseSeLogerDetailCard(html, parseEmbeddedWindowJson);
  const text = [card?.description, ...(card?.tags ?? []), html]
    .filter(Boolean)
    .join("\n");

  const classifiedData = extractClassifiedDataFromDetailHtml(html);
  const coords =
    (classifiedData
      ? extractSeLogerCoordsFromClassifiedData(classifiedData)
      : null) ?? parseSeLogerCoordinatesFromHtml(html);

  return {
    ...energy,
    description: card?.description ?? null,
    surface: card?.surface ?? null,
    bedrooms: card?.bedroomCount ?? null,
    rooms: card?.rooms ?? null,
    landSurface: parseSeLogerLandSurface(text),
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
  };
}
