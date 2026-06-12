import { httpClient } from "../http/client.js";

const SUGGEST_URL = "https://res.bienici.com/suggest.json";

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
  const response = await httpClient(SUGGEST_URL, {
    searchParams: { q: query.trim() },
    headers: { Accept: "application/json" },
    throwHttpErrors: false,
  });

  if (response.statusCode !== 200) return [];
  return JSON.parse(response.body) as BienIciSuggestResult[];
}
