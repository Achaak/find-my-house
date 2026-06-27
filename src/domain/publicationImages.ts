import type { ListingSource } from "../types/listing.js";
import { normalizeImageUrlForDedup } from "../utils/images/normalizeImageUrl.js";
import {
  arePerceptualHashesSimilar,
  PERCEPTUAL_DEDUP_THRESHOLD,
} from "../utils/images/perceptualHash.js";

export type PropertyPhoto = {
  url: string;
  source: ListingSource;
  publicationId: number;
};

export type PublicationImageInput = {
  id: number;
  source: ListingSource;
  imageUrls: string[] | null;
  imageLocalHashes: Record<string, string> | null;
  imagePerceptualHashes?: Record<string, string> | null;
  isActive: boolean;
};

export function parseImageUrls(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const urls = value.filter((item): item is string => typeof item === "string");
  return urls.length > 0 ? urls : null;
}

export function parseImageLocalHashes(
  value: unknown
): Record<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] =>
      typeof entry[0] === "string" && typeof entry[1] === "string"
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

export const parseImagePerceptualHashes = parseImageLocalHashes;

const SOURCE_PRIORITY: ListingSource[] = [
  "bienici",
  "seloger",
  "logicimmo",
  "leboncoin",
];

function sourceRank(source: ListingSource): number {
  const index = SOURCE_PRIORITY.indexOf(source);
  return index === -1 ? SOURCE_PRIORITY.length : index;
}

export function resolvePhotoUrl(
  remoteUrl: string,
  localHashes: Record<string, string> | null | undefined
): string {
  const hash = localHashes?.[remoteUrl];
  return hash ? `/api/media/${hash}` : remoteUrl;
}

type PhotoDedupeState = {
  seenUrls: Set<string>;
  seenContentHashes: Set<string>;
  seenPerceptualHashes: string[];
};

function createPhotoDedupeState(): PhotoDedupeState {
  return {
    seenUrls: new Set<string>(),
    seenContentHashes: new Set<string>(),
    seenPerceptualHashes: [],
  };
}

function isDuplicatePhoto(
  remoteUrl: string,
  contentHash: string | undefined,
  perceptualHash: string | undefined,
  state: PhotoDedupeState,
  threshold = PERCEPTUAL_DEDUP_THRESHOLD
): boolean {
  const urlKey = normalizeImageUrlForDedup(remoteUrl);
  if (state.seenUrls.has(urlKey)) return true;

  if (contentHash && state.seenContentHashes.has(contentHash)) return true;

  if (perceptualHash) {
    for (const seen of state.seenPerceptualHashes) {
      if (arePerceptualHashesSimilar(perceptualHash, seen, threshold)) {
        return true;
      }
    }
  }

  return false;
}

function registerPhoto(
  remoteUrl: string,
  contentHash: string | undefined,
  perceptualHash: string | undefined,
  state: PhotoDedupeState
): void {
  state.seenUrls.add(normalizeImageUrlForDedup(remoteUrl));
  if (contentHash) state.seenContentHashes.add(contentHash);
  if (perceptualHash) state.seenPerceptualHashes.push(perceptualHash);
}

export function mergePropertyPhotos(
  publications: readonly PublicationImageInput[],
  options?: { activeOnly?: boolean }
): PropertyPhoto[] {
  const activeOnly = options?.activeOnly ?? true;
  const ordered = [...publications]
    .filter((publication) => !activeOnly || publication.isActive)
    .sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || a.id - b.id);

  const state = createPhotoDedupeState();
  const photos: PropertyPhoto[] = [];

  for (const publication of ordered) {
    const urls = publication.imageUrls ?? [];
    const localHashes = publication.imageLocalHashes;
    const perceptualHashes = publication.imagePerceptualHashes;

    for (const remoteUrl of urls) {
      const contentHash = localHashes?.[remoteUrl];
      const perceptualHash = perceptualHashes?.[remoteUrl];

      if (isDuplicatePhoto(remoteUrl, contentHash, perceptualHash, state)) {
        continue;
      }

      registerPhoto(remoteUrl, contentHash, perceptualHash, state);

      photos.push({
        url: resolvePhotoUrl(remoteUrl, localHashes),
        source: publication.source,
        publicationId: publication.id,
      });
    }
  }

  return photos;
}

export function publicationNeedsGalleryEnrichment(publication: {
  enrichedAt: string | null;
}): boolean {
  return publication.enrichedAt === null;
}

export function propertyNeedsGalleryEnrichment(
  publications: readonly { isActive: boolean; enrichedAt: string | null }[]
): boolean {
  return publications.some(
    (publication) =>
      publication.isActive && publicationNeedsGalleryEnrichment(publication)
  );
}
