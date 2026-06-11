import { bboxCenter, type GeoPoint } from "./geo.js";

interface BienIciSuggestResult {
  name: string;
  type?: string;
  insee_code?: string;
  boundingBox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  zoneIds?: string[];
}

export interface BienIciPlace {
  name: string;
  center: GeoPoint;
  cityZoneIds: string[];
  departmentZoneIds: string[];
}

export interface BienIciTravelOrigin {
  address: string;
  center: GeoPoint;
}

interface BienIciGeocoderSuggestion {
  text?: string;
  label?: string;
  name?: string;
  centroid?: { coordinates: [number, number] };
  tags?: string[];
}

async function fetchSuggest(query: string): Promise<BienIciSuggestResult[]> {
  const response = await fetch(
    `https://res.bienici.com/suggest.json?q=${encodeURIComponent(query.trim())}`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) return [];
  return response.json() as Promise<BienIciSuggestResult[]>;
}

export async function resolveBienIciPlace(
  city: string
): Promise<BienIciPlace | null> {
  const results = await fetchSuggest(city);
  const match = results.find((r) => r.boundingBox && r.zoneIds?.length);
  if (!match?.boundingBox || !match.zoneIds?.length) return null;

  const departmentCode = match.insee_code?.slice(0, 2);
  let departmentZoneIds: string[] = [];

  if (departmentCode) {
    const deptResults = await fetchSuggest(departmentCode);
    const dept = deptResults.find(
      (r) => r.type === "department" && r.insee_code === departmentCode
    );
    departmentZoneIds = dept?.zoneIds ?? [];
  }

  return {
    name: match.name,
    center: bboxCenter(match.boundingBox),
    cityZoneIds: match.zoneIds,
    departmentZoneIds,
  };
}

/** Point de départ pour le temps de trajet (géocodeur Bien'ici, pas le centre bbox). */
export async function resolveBienIciTravelOrigin(
  city: string
): Promise<BienIciTravelOrigin | null> {
  const response = await fetch(
    `https://geocoder.carte-bienici.com/suggestions?q=${encodeURIComponent(city.trim())}&tags=address,street,municipality,housenumber,locality`,
    { headers: { Accept: "application/json" } }
  );

  if (!response.ok) return null;

  const results = (await response.json()) as BienIciGeocoderSuggestion[];
  const cityLower = city.trim().toLowerCase();
  const match =
    results.find(
      (r) =>
        r.name?.toLowerCase() === cityLower &&
        r.centroid?.coordinates &&
        r.tags?.includes("municipality")
    ) ??
    results.find((r) => r.centroid?.coordinates && r.tags?.includes("municipality")) ??
    results.find((r) => r.centroid?.coordinates);

  if (!match?.centroid?.coordinates) return null;

  const [lng, lat] = match.centroid.coordinates;
  return {
    address: match.text ?? match.label ?? city,
    center: { lat, lng },
  };
}
