import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { imageStoreDir, perceptualIndexPath } from "../config/imageStore.js";
import {
  arePerceptualHashesSimilar,
  PERCEPTUAL_DEDUP_THRESHOLD,
} from "../utils/images/perceptualHash.js";

type PerceptualIndexEntry = {
  perceptualHash: string;
  contentHash: string;
};

type PerceptualIndexFile = {
  entries: PerceptualIndexEntry[];
};

const INDEX_PATH = perceptualIndexPath();

let indexCache: PerceptualIndexEntry[] | null = null;
let indexWriteQueue: Promise<void> = Promise.resolve();

async function loadIndexFromDisk(): Promise<PerceptualIndexEntry[]> {
  try {
    await access(INDEX_PATH);
    const raw = await readFile(INDEX_PATH, "utf8");
    const parsed = JSON.parse(raw) as PerceptualIndexFile;
    if (!Array.isArray(parsed.entries)) return [];
    return parsed.entries.filter(
      (entry): entry is PerceptualIndexEntry =>
        typeof entry.perceptualHash === "string" &&
        typeof entry.contentHash === "string"
    );
  } catch {
    return [];
  }
}

async function getIndex(): Promise<PerceptualIndexEntry[]> {
  indexCache ??= await loadIndexFromDisk();
  return indexCache;
}

function persistIndex(entries: PerceptualIndexEntry[]): Promise<void> {
  indexWriteQueue = indexWriteQueue.then(async () => {
    await mkdir(imageStoreDir(), { recursive: true });
    const payload: PerceptualIndexFile = { entries };
    await writeFile(
      INDEX_PATH,
      `${JSON.stringify(payload, null, 2)}\n`,
      "utf8"
    );
    indexCache = entries;
  });
  return indexWriteQueue;
}

export async function findContentHashByPerceptualHash(
  perceptualHash: string,
  threshold: number = PERCEPTUAL_DEDUP_THRESHOLD
): Promise<string | null> {
  const entries = await getIndex();
  for (const entry of entries) {
    if (
      arePerceptualHashesSimilar(
        perceptualHash,
        entry.perceptualHash,
        threshold
      )
    ) {
      return entry.contentHash;
    }
  }
  return null;
}

export async function registerPerceptualImage(
  perceptualHash: string,
  contentHash: string,
  threshold: number = PERCEPTUAL_DEDUP_THRESHOLD
): Promise<void> {
  const entries = await getIndex();
  const hasSimilar = entries.some((entry) =>
    arePerceptualHashesSimilar(perceptualHash, entry.perceptualHash, threshold)
  );
  if (hasSimilar) return;

  await persistIndex([...entries, { perceptualHash, contentHash }]);
}

/** Test helper — resets in-memory cache. */
export function resetPerceptualImageIndexCache(): void {
  indexCache = null;
  indexWriteQueue = Promise.resolve();
}
