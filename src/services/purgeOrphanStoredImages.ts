import { readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { PrismaClient } from "../generated/prisma/client.js";
import { imageStoreDir } from "../config/imageStore.js";
import {
  parseImageLocalHashes,
  parseImageUrls,
} from "../domain/publicationImages.js";
import {
  prunePerceptualIndexToContentHashes,
  resetPerceptualImageIndexCache,
} from "./perceptualImageIndex.js";

export type PurgeOrphanStoredImagesResult = {
  prunedHashEntries: number;
  deletedFiles: number;
  prunedIndexEntries: number;
};

export type PurgeOrphanStoredImagesOptions = {
  storeDir?: string;
};

const IMAGE_FILE_RE = /^([a-f0-9]+)\.(jpg|jpeg|png|webp|gif)$/i;

function pruneHashMapToUrls(
  hashes: Record<string, string> | null,
  urls: Set<string>
): { next: Record<string, string> | null; removed: number } {
  if (!hashes) return { next: null, removed: 0 };

  const entries = Object.entries(hashes);
  const kept = entries.filter(([url]) => urls.has(url));
  const removed = entries.length - kept.length;
  if (removed === 0) return { next: hashes, removed: 0 };
  if (kept.length === 0) return { next: {}, removed };
  return { next: Object.fromEntries(kept), removed };
}

/**
 * Drop stale url→hash keys, delete image files not referenced by any
 * publication, and prune the perceptual dedup index accordingly.
 */
export async function purgeOrphanStoredImages(
  prisma: PrismaClient,
  options: PurgeOrphanStoredImagesOptions = {}
): Promise<PurgeOrphanStoredImagesResult> {
  const storeDir = options.storeDir ?? imageStoreDir();
  let prunedHashEntries = 0;
  const referenced = new Set<string>();

  const publications = await prisma.listingPublication.findMany({
    select: {
      id: true,
      imageUrls: true,
      imageLocalHashes: true,
      imagePerceptualHashes: true,
    },
  });

  for (const publication of publications) {
    const urls = new Set(parseImageUrls(publication.imageUrls) ?? []);
    const local = pruneHashMapToUrls(
      parseImageLocalHashes(publication.imageLocalHashes),
      urls
    );
    const perceptual = pruneHashMapToUrls(
      parseImageLocalHashes(publication.imagePerceptualHashes),
      urls
    );

    if (local.removed > 0 || perceptual.removed > 0) {
      prunedHashEntries += local.removed + perceptual.removed;
      await prisma.listingPublication.update({
        where: { id: publication.id },
        data: {
          ...(local.removed > 0 ? { imageLocalHashes: local.next ?? {} } : {}),
          ...(perceptual.removed > 0
            ? { imagePerceptualHashes: perceptual.next ?? {} }
            : {}),
        },
      });
    }

    const effectiveLocal =
      local.removed > 0
        ? local.next
        : parseImageLocalHashes(publication.imageLocalHashes);
    if (!effectiveLocal) continue;
    for (const contentHash of Object.values(effectiveLocal)) {
      referenced.add(contentHash.toLowerCase());
    }
  }

  let deletedFiles = 0;
  let names: string[];
  try {
    names = await readdir(storeDir);
  } catch {
    names = [];
  }

  for (const name of names) {
    const match = IMAGE_FILE_RE.exec(name);
    if (!match?.[1]) continue;
    const contentHash = match[1].toLowerCase();
    if (referenced.has(contentHash)) continue;
    await unlink(join(storeDir, name));
    deletedFiles += 1;
  }

  const prunedIndexEntries =
    await prunePerceptualIndexToContentHashes(referenced);

  return { prunedHashEntries, deletedFiles, prunedIndexEntries };
}

export { resetPerceptualImageIndexCache };
