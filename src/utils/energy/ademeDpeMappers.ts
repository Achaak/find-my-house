export type DpeDatasetKind = "recent" | "legacy";

export type DpeSearchResult = {
  numeroDpe: string;
  address: string;
  postalCode: string | null;
  departmentCode: string | null;
  dpeClass: string | null;
  gesClass: string | null;
  surfaceM2: number | null;
  constructionYear: number | null;
  consumptionKwhM2Year: number | null;
  emissionGesKgM2Year: number | null;
  establishmentDate: string | null;
  expiryDate: string | null;
  buildingType: string | null;
  addressMatchScore: number | null;
  latitude: number | null;
  longitude: number | null;
  dataset: DpeDatasetKind;
};

export type RecentDpeLine = {
  numero_dpe?: string;
  adresse_ban?: string;
  adresse_complete_brut?: string;
  code_postal_ban?: string;
  code_departement_ban?: string;
  etiquette_dpe?: string;
  etiquette_ges?: string;
  surface_habitable_logement?: number;
  annee_construction?: number;
  conso_5_usages_par_m2_ep?: number;
  emission_ges_5_usages_par_m2?: number;
  date_etablissement_dpe?: string;
  date_fin_validite_dpe?: string;
  type_batiment?: string;
  score_ban?: number;
  _geopoint?: string;
  _score?: number;
};

export type LegacyDpeLine = {
  numero_dpe?: string;
  geo_adresse?: string;
  classe_consommation_energie?: string;
  classe_estimation_ges?: string;
  surface_thermique_lot?: number;
  annee_construction?: number;
  consommation_energie?: number;
  date_etablissement_dpe?: string;
  tr002_type_batiment_description?: string;
  geo_score?: number;
  latitude?: number;
  longitude?: number;
  tv016_departement_code?: string;
  _score?: number;
};

export function parseGeopoint(
  geopoint?: string
): { lat: number; lng: number } | null {
  if (!geopoint) return null;

  const [lat, lng] = geopoint.split(",").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

export function extractPostalCodeFromAddress(address: string): string | null {
  const match = /\b(\d{5})\b/.exec(address);
  return match?.[1] ?? null;
}

export function mapRecentLine(line: RecentDpeLine): DpeSearchResult | null {
  if (!line.numero_dpe) return null;

  const coords = parseGeopoint(line._geopoint);
  const address =
    line.adresse_ban ?? line.adresse_complete_brut ?? "Adresse inconnue";

  return {
    numeroDpe: line.numero_dpe,
    address,
    postalCode: line.code_postal_ban ?? extractPostalCodeFromAddress(address),
    departmentCode: line.code_departement_ban ?? null,
    dpeClass: line.etiquette_dpe ?? null,
    gesClass: line.etiquette_ges ?? null,
    surfaceM2: line.surface_habitable_logement ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.conso_5_usages_par_m2_ep ?? null,
    emissionGesKgM2Year: line.emission_ges_5_usages_par_m2 ?? null,
    establishmentDate: line.date_etablissement_dpe ?? null,
    expiryDate: line.date_fin_validite_dpe ?? null,
    buildingType: line.type_batiment ?? null,
    addressMatchScore: line.score_ban ?? line._score ?? null,
    latitude: coords?.lat ?? null,
    longitude: coords?.lng ?? null,
    dataset: "recent",
  };
}

export function mapLegacyLine(line: LegacyDpeLine): DpeSearchResult | null {
  if (!line.numero_dpe) return null;

  const address = line.geo_adresse ?? "Adresse inconnue";

  return {
    numeroDpe: line.numero_dpe,
    address,
    postalCode: extractPostalCodeFromAddress(address),
    departmentCode: line.tv016_departement_code ?? null,
    dpeClass: line.classe_consommation_energie ?? null,
    gesClass: line.classe_estimation_ges ?? null,
    surfaceM2: line.surface_thermique_lot ?? null,
    constructionYear: line.annee_construction ?? null,
    consumptionKwhM2Year: line.consommation_energie ?? null,
    emissionGesKgM2Year: null,
    establishmentDate: line.date_etablissement_dpe ?? null,
    expiryDate: null,
    buildingType: line.tr002_type_batiment_description ?? null,
    addressMatchScore: line.geo_score ?? line._score ?? null,
    latitude: line.latitude ?? null,
    longitude: line.longitude ?? null,
    dataset: "legacy",
  };
}

export function mapDatasetResults(
  recentLines: RecentDpeLine[],
  legacyLines: LegacyDpeLine[]
): DpeSearchResult[] {
  return [
    ...recentLines.map(mapRecentLine),
    ...legacyLines.map(mapLegacyLine),
  ].filter((result): result is DpeSearchResult => result !== null);
}
