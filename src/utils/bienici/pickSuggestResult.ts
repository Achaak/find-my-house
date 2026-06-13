import type { BienIciSuggestResult } from "./suggest.js";

function normalizeCity(name: string): string {
  return name.trim().toLowerCase();
}

function hasPostalCode(
  result: BienIciSuggestResult,
  postalCode: string
): boolean {
  return result.postalCodes?.includes(postalCode) ?? false;
}

/** Picks the best BienIci suggest hit for a city, optionally disambiguated by postal code. */
export function pickSuggestResult(
  results: BienIciSuggestResult[],
  city: string,
  postalCode?: string
): BienIciSuggestResult | undefined {
  const cityLower = normalizeCity(city);

  const withInsee = results.filter(
    (result) => result.insee_code && result.boundingBox
  );
  const nameMatches = withInsee.filter(
    (result) => normalizeCity(result.name) === cityLower
  );

  if (postalCode) {
    const byNameAndPostal = nameMatches.find((result) =>
      hasPostalCode(result, postalCode)
    );
    if (byNameAndPostal) return byNameAndPostal;

    const byPostal = withInsee.find((result) =>
      hasPostalCode(result, postalCode)
    );
    if (byPostal) return byPostal;
  }

  return nameMatches[0] ?? withInsee[0];
}

/** Picks a BienIci place row (zone IDs required for ads search). */
export function pickBienIciPlaceResult(
  results: BienIciSuggestResult[],
  city: string,
  postalCode?: string
): BienIciSuggestResult | undefined {
  const cityLower = normalizeCity(city);

  const withZones = results.filter(
    (result) => result.boundingBox && result.zoneIds?.length
  );
  const nameMatches = withZones.filter(
    (result) => normalizeCity(result.name) === cityLower
  );

  if (postalCode) {
    const byNameAndPostal = nameMatches.find((result) =>
      hasPostalCode(result, postalCode)
    );
    if (byNameAndPostal) return byNameAndPostal;

    const byPostal = withZones.find((result) =>
      hasPostalCode(result, postalCode)
    );
    if (byPostal) return byPostal;
  }

  return nameMatches[0] ?? withZones[0];
}
