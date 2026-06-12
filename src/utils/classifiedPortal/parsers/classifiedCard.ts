import { parseEnergyMetricsFromText } from "../../energy/energyMetrics.js";
import type { ClassifiedCard, ClassifiedData } from "../types.js";
import { extractClassifiedCoordsFromData } from "./coordinates.js";
import { parseClassifiedEnergyClassesFromText } from "./energyText.js";
import { parseClassifiedLandSurface } from "./landSurface.js";
import { applyClassifiedSearchMetadata } from "./searchMetadata.js";

export function mapClassifiedDataToCard(
  data: ClassifiedData
): ClassifiedCard | null {
  const id = data.metadata?.legacyId ?? data.id;
  if (!id) return null;

  const photos = data.gallery?.images
    ?.map((image) => image.url)
    .filter((url): url is string => Boolean(url));

  const description = data.mainDescription?.description;
  const keyfacts = data.hardFacts?.keyfacts;
  const text = [description, ...(keyfacts ?? [])].filter(Boolean).join("\n");
  const textEnergy = parseClassifiedEnergyClassesFromText(text);
  const metrics = parseEnergyMetricsFromText(description);
  const coords = extractClassifiedCoordsFromData(data);

  return applyClassifiedSearchMetadata({
    id,
    cardType: "classified",
    title: data.hardFacts?.title,
    estateType: data.rawData?.propertyTypeLabel,
    pricing: {
      rawPrice:
        data.rawData?.price !== undefined
          ? String(data.rawData.price)
          : undefined,
      price: data.hardFacts?.price?.formatted,
    },
    surface: data.rawData?.surface?.main,
    rooms: data.rawData?.nbroom,
    bedroomCount: data.rawData?.nbbedroom,
    isNew: data.tags?.isNew,
    cityLabel: data.location?.address?.city,
    zipCode: data.location?.address?.zipCode,
    description,
    photos,
    classifiedURL: data.url,
    tags: keyfacts,
    energyClass: data.energyClass ?? textEnergy.dpeClass ?? undefined,
    gesClass: data.gesClass ?? textEnergy.gesClass ?? undefined,
    dpeConsumptionKwhM2: metrics.dpeConsumptionKwhM2 ?? undefined,
    gesEmissionKgM2: metrics.gesEmissionKgM2 ?? undefined,
    landSurface: parseClassifiedLandSurface(text) ?? undefined,
    latitude: coords?.lat,
    longitude: coords?.lng,
  });
}

export function parseClassifiedDetailCard(
  html: string,
  parseEmbedded: (varName: string, html: string) => unknown
): ClassifiedCard | null {
  const fetcher = parseEmbedded("__UFRN_FETCHER__", html) as {
    data?: Record<string, { pageProps?: { classifiedData?: ClassifiedData } }>;
  } | null;

  const classifiedData =
    fetcher?.data?.["classified-detail-init-data"]?.pageProps?.classifiedData;
  if (classifiedData) return mapClassifiedDataToCard(classifiedData);

  const initialData = parseEmbedded("initialData", html) as {
    classified?: ClassifiedData;
  } | null;
  if (initialData?.classified) {
    return mapClassifiedDataToCard(initialData.classified);
  }

  return null;
}

export { parseClassifiedLandSurface } from "./landSurface.js";
