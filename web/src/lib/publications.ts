import type { ListingSource, Property } from "@find-my-house/api-types";

export type DisplayPublication = {
  key: string;
  source: ListingSource;
  url: string;
  isActive: boolean;
};

export function getDisplayPublications(
  property: Pick<Property, "publications" | "source" | "url">
): DisplayPublication[] {
  const publications = property.publications ?? [];
  const active = publications.filter((publication) => publication.isActive);
  const list =
    active.length > 0 ? active : publications.length > 0 ? publications : null;

  if (list) {
    return list.map((publication) => ({
      key: String(publication.id),
      source: publication.source,
      url: publication.url,
      isActive: publication.isActive,
    }));
  }

  return [
    {
      key: property.source,
      source: property.source,
      url: property.url,
      isActive: true,
    },
  ];
}
