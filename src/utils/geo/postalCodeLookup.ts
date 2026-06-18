import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { GeoPoint } from "./geo.js";
import type { PostalCodeEntry, PostalCodeIndex } from "./postalCodeIndex.js";

let cachedIndex: PostalCodeIndex | null = null;

function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function resolveDataPath(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(moduleDir, "../../data/postal-codes.json"),
    join(process.cwd(), "src/data/postal-codes.json"),
  ];

  for (const candidate of candidates) {
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "postal-codes.json not found — run `pnpm geo:build-postal-codes`"
  );
}

function loadPostalCodeIndex(): PostalCodeIndex {
  if (cachedIndex) return cachedIndex;
  const raw = readFileSync(resolveDataPath(), "utf8");
  cachedIndex = JSON.parse(raw) as PostalCodeIndex;
  return cachedIndex;
}

/** Clears the in-memory postal code cache (tests). */
export function clearPostalCodeIndexCache(): void {
  cachedIndex = null;
}

function pickEntry(
  record: PostalCodeEntry | PostalCodeEntry[],
  city?: string
): PostalCodeEntry | null {
  if (!Array.isArray(record)) return record;

  if (city) {
    const normalized = normalizeCity(city);
    const match = record.find(
      (entry) => normalizeCity(entry.city) === normalized
    );
    if (match) return match;
  }

  return record[0] ?? null;
}

export function lookupPostalCodeEntry(
  postalCode: string,
  city?: string
): PostalCodeEntry | null {
  const normalizedPostalCode = postalCode.trim();
  if (!/^\d{5}$/.test(normalizedPostalCode)) return null;

  const index = loadPostalCodeIndex();
  if (!(normalizedPostalCode in index)) return null;

  const record = index[normalizedPostalCode];

  return pickEntry(record, city);
}

export function lookupPostalCodeCoords(
  postalCode: string,
  city?: string
): GeoPoint | null {
  const entry = lookupPostalCodeEntry(postalCode, city);
  if (!entry) return null;
  return { lat: entry.lat, lng: entry.lng };
}
