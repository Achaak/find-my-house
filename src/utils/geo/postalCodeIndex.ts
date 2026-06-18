export type PostalCodeEntry = {
  lat: number;
  lng: number;
  city: string;
};

export type PostalCodeIndex = Record<
  string,
  PostalCodeEntry | PostalCodeEntry[]
>;

type CommuneResponse = {
  nom: string;
  codesPostaux: string[];
  centre?: { coordinates: [number, number] };
};

function normalizeCity(city: string): string {
  return city
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function mergeEntry(
  index: PostalCodeIndex,
  postalCode: string,
  entry: PostalCodeEntry
): void {
  if (!(postalCode in index)) {
    index[postalCode] = entry;
    return;
  }

  const existing = index[postalCode];

  if (Array.isArray(existing)) {
    if (
      !existing.some(
        (candidate) =>
          normalizeCity(candidate.city) === normalizeCity(entry.city)
      )
    ) {
      existing.push(entry);
    }
    return;
  }

  if (normalizeCity(existing.city) === normalizeCity(entry.city)) {
    return;
  }

  index[postalCode] = [existing, entry];
}

export function buildPostalCodeIndex(
  communes: CommuneResponse[]
): PostalCodeIndex {
  const index: PostalCodeIndex = {};

  for (const commune of communes) {
    const coords = commune.centre?.coordinates;
    if (!coords) continue;

    const [lng, lat] = coords;
    const entry: PostalCodeEntry = { lat, lng, city: commune.nom };

    for (const postalCode of commune.codesPostaux) {
      mergeEntry(index, postalCode, entry);
    }
  }

  return index;
}
