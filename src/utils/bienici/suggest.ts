import { browserPageFetch } from "../browser/client.js";

const SUGGEST_URL = "https://res.bienici.com/suggest.json";
const BIENICI_ORIGIN = "https://www.bienici.com/";

export type BienIciSuggestResult = {
  name: string;
  type?: string;
  insee_code?: string;
  postalCodes?: string[];
  boundingBox?: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  zoneIds?: string[];
};

export async function fetchBienIciSuggest(
  query: string
): Promise<BienIciSuggestResult[]> {
  const url = `${SUGGEST_URL}?q=${encodeURIComponent(query.trim())}`;
  const response = await browserPageFetch(url, {
    warmUpOrigin: BIENICI_ORIGIN,
    headers: { Accept: "application/json" },
  });

  if (response.status !== 200) return [];
  return JSON.parse(response.body) as BienIciSuggestResult[];
}
