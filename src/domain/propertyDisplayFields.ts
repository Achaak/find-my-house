import { pickLongestDescription } from "./descriptionEquivalence.js";
import {
  mergePropertyPhotos,
  type PublicationImageInput,
} from "./publicationImages.js";
import type { PublicationRow } from "../types/listing.js";

export function computePropertyDescription(
  publications: readonly Pick<PublicationRow, "description" | "isActive">[]
): string | null {
  return pickLongestDescription(
    publications
      .filter((publication) => publication.isActive)
      .map((publication) => publication.description)
  );
}

export function computePropertyImageUrl(
  publications: readonly PublicationImageInput[]
): string | null {
  const photos = mergePropertyPhotos(publications);
  if (photos.length > 0) return photos[0]?.url ?? null;

  for (const publication of publications) {
    if (!publication.isActive || !publication.imageUrls?.length) continue;
    const localHashes = publication.imageLocalHashes;
    const remoteUrl = publication.imageUrls[0];
    if (!remoteUrl) continue;
    const hash = localHashes?.[remoteUrl];
    return hash ? `/api/media/${hash}` : remoteUrl;
  }

  return null;
}
