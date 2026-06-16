const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  house: "house",
  maison: "house",
  pavillon: "house",
  propriété: "house",
  propriete: "house",
  flat: "apartment",
  apartment: "apartment",
  appartement: "apartment",
  loft: "loft",
  castle: "castle",
  chateau: "castle",
  château: "castle",
  townhouse: "townhouse",
  "maison de ville": "townhouse",
  villa: "villa",
};

/**
 * Canonical property type slug for cross-portal comparison and deduplication.
 */
export function canonicalPropertyType(propertyType: string | null): string {
  if (!propertyType) return "";

  const normalized = propertyType.trim().toLowerCase().replace(/\s+/g, " ");
  const aliased = PROPERTY_TYPE_ALIASES[normalized];
  if (aliased) return aliased;

  if (normalized.startsWith("maison")) return "house";
  if (
    normalized.startsWith("propriété") ||
    normalized.startsWith("propriete")
  ) {
    return "house";
  }

  return normalized;
}
