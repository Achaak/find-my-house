import { parseEnergyMetricsFromText } from "../../energy/energyMetrics.js";
import type { SeLogerClassifiedCard, SeLogerClassifiedData } from "../types.js";
import { parseSeLogerEnergyClassesFromText } from "./energyText.js";
import { applySeLogerSearchMetadata } from "./searchMetadata.js";

export function mapClassifiedDataToCard(
  data: SeLogerClassifiedData
): SeLogerClassifiedCard | null {
  const id = data.metadata?.legacyId ?? data.id;
  if (!id) return null;

  const photos = data.gallery?.images
    ?.map((image) => image.url)
    .filter((url): url is string => Boolean(url));

  const description = data.mainDescription?.description;
  const keyfacts = data.hardFacts?.keyfacts;
  const textEnergy = parseSeLogerEnergyClassesFromText(
    [description, ...(keyfacts ?? [])].filter(Boolean).join("\n")
  );
  const metrics = parseEnergyMetricsFromText(description);

  return applySeLogerSearchMetadata({
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
  });
}

export function parseSeLogerDetailCard(
  html: string,
  parseEmbedded: (varName: string, html: string) => unknown
): SeLogerClassifiedCard | null {
  const fetcher = parseEmbedded("__UFRN_FETCHER__", html) as {
    data?: Record<
      string,
      { pageProps?: { classifiedData?: SeLogerClassifiedData } }
    >;
  } | null;

  const classifiedData =
    fetcher?.data?.["classified-detail-init-data"]?.pageProps?.classifiedData;
  if (classifiedData) return mapClassifiedDataToCard(classifiedData);

  const initialData = parseEmbedded("initialData", html) as {
    classified?: SeLogerClassifiedData;
  } | null;
  if (initialData?.classified) {
    return mapClassifiedDataToCard(initialData.classified);
  }

  return null;
}

export function parseSeLogerLandSurface(text: string): number | null {
  const match =
    /terrain\s*(?:de\s+)?(\d[\d\s]*)\s*m²/i.exec(text) ??
    /(\d[\d\s]*)\s*m²\s*(?:de\s+)?terrain/i.exec(text);
  if (!match) return null;
  const parsed = Number(match[1].replace(/\s/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}
