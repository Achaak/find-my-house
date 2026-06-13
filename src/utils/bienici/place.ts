import { browserPageFetch } from "../browser/client.js";
import { bboxCenter, type GeoPoint } from "../geo/geo.js";
import { fetchBienIciSuggest } from "./suggest.js";
import { pickBienIciPlaceResult } from "./pickSuggestResult.js";

const BIENICI_ORIGIN = "https://www.bienici.com/";

export type BienIciPlace = {
  name: string;
  center: GeoPoint;
  cityZoneIds: string[];
  departmentZoneIds: string[];
  postalCodes?: string[];
};

export type BienIciTravelOrigin = {
  address: string;
  center: GeoPoint;
};

type BienIciGeocoderSuggestion = {
  text?: string;
  label?: string;
  name?: string;
  centroid?: { coordinates: [number, number] };
  tags?: string[];
};

export async function resolveBienIciPlace(
  city: string,
  postalCode?: string
): Promise<BienIciPlace | null> {
  const results = await fetchBienIciSuggest(city);
  const match = pickBienIciPlaceResult(results, city, postalCode);
  if (!match?.boundingBox || !match.zoneIds?.length) return null;

  const departmentCode = match.insee_code?.slice(0, 2);
  let departmentZoneIds: string[] = [];

  if (departmentCode) {
    const deptResults = await fetchBienIciSuggest(departmentCode);
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
    postalCodes: match.postalCodes,
  };
}

/** Origin point for travel time (Bien'ici geocoder, not the bbox center). */
export async function resolveBienIciTravelOrigin(
  city: string,
  postalCode?: string
): Promise<BienIciTravelOrigin | null> {
  const query = postalCode ? `${city.trim()} ${postalCode}` : city.trim();
  const url = new URL("https://geocoder.carte-bienici.com/suggestions");
  url.searchParams.set("q", query);
  url.searchParams.set(
    "tags",
    "address,street,municipality,housenumber,locality"
  );

  const response = await browserPageFetch(url.toString(), {
    warmUpOrigin: BIENICI_ORIGIN,
    headers: { Accept: "application/json" },
  });

  if (response.status !== 200) return null;

  const results = JSON.parse(response.body) as BienIciGeocoderSuggestion[];
  const cityLower = city.trim().toLowerCase();
  const match =
    results.find(
      (r) =>
        r.name?.toLowerCase() === cityLower &&
        r.centroid?.coordinates &&
        r.tags?.includes("municipality")
    ) ??
    results.find(
      (r) => r.centroid?.coordinates && r.tags?.includes("municipality")
    ) ??
    results.find((r) => r.centroid?.coordinates);

  if (!match?.centroid?.coordinates) return null;

  const [lng, lat] = match.centroid.coordinates;
  return {
    address: match.text ?? match.label ?? city,
    center: { lat, lng },
  };
}
