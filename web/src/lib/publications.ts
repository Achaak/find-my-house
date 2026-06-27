import type { Property } from "@find-my-house/api-types";

export type DisplayPublication = {
  key: string;
  source: Property["publications"][number]["source"];
  url: string;
  isActive: boolean;
};

export function getDisplayPublications(
  property: Pick<Property, "publications">
): DisplayPublication[] {
  const publications = property.publications ?? [];

  return publications
    .filter((publication) => publication.isActive)
    .map((publication) => ({
      key: String(publication.id),
      source: publication.source,
      url: publication.url,
      isActive: true,
    }));
}

export function hasActivePublications(
  property: Pick<Property, "publications">
): boolean {
  return getDisplayPublications(property).length > 0;
}
