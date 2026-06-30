import { createHash } from "node:crypto";
import { mkdir, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { createLogger } from "../utils/logger.js";
import { imageStoreDir } from "../config/imageStore.js";
import { computePerceptualHash } from "../utils/images/perceptualHash.js";
import {
  findContentHashByPerceptualHash,
  registerPerceptualImage,
} from "./perceptualImageIndex.js";

const log = createLogger("images:download");

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type DownloadedImage = {
  contentHash: string;
  perceptualHash: string;
};

export type PublicationImageDownloadResult = {
  localHashes: Record<string, string>;
  perceptualHashes: Record<string, string>;
};

function extensionFromContentType(contentType: string | null): string {
  if (!contentType) return "jpg";
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return EXTENSION_BY_MIME[normalized] ?? "jpg";
}

function extensionFromUrl(url: string): string | null {
  const match = /\.([a-zA-Z0-9]{2,5})(?:$|\?)/.exec(url);
  const ext = match?.[1]?.toLowerCase();
  if (!ext || ext === "jpeg") return ext === "jpeg" ? "jpg" : null;
  if (["jpg", "png", "webp", "gif"].includes(ext)) return ext;
  return null;
}

export function hashImageContent(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function localImagePath(contentHash: string, extension: string): string {
  return join(imageStoreDir(), `${contentHash}.${extension}`);
}

async function storeImageBuffer(
  buffer: Buffer,
  remoteUrl: string,
  contentType: string | null
): Promise<DownloadedImage | null> {
  if (buffer.length === 0) return null;

  let perceptualHash: string;
  try {
    perceptualHash = await computePerceptualHash(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Perceptual hash failed for ${remoteUrl}: ${message}`);
    return null;
  }

  const contentHashFromBytes = hashImageContent(buffer);
  const reusedContentHash =
    await findContentHashByPerceptualHash(perceptualHash);
  const contentHash = reusedContentHash ?? contentHashFromBytes;

  const extension =
    extensionFromUrl(remoteUrl) ?? extensionFromContentType(contentType);
  const filePath = localImagePath(contentHash, extension);

  if (!reusedContentHash) {
    try {
      await access(filePath);
    } catch {
      await mkdir(imageStoreDir(), { recursive: true });
      await writeFile(filePath, buffer);
    }
    await registerPerceptualImage(perceptualHash, contentHash);
  }

  return { contentHash, perceptualHash };
}

export async function downloadImageToStore(
  remoteUrl: string
): Promise<DownloadedImage | null> {
  try {
    const response = await fetch(remoteUrl, {
      headers: {
        Accept: "image/*",
        "User-Agent":
          "Mozilla/5.0 (compatible; FindMyHouse/1.0; +https://github.com/Achaak/find-my-home)",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      log.warn(`Download failed (${String(response.status)}): ${remoteUrl}`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await storeImageBuffer(
      buffer,
      remoteUrl,
      response.headers.get("content-type")
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(`Download error for ${remoteUrl}: ${message}`);
    return null;
  }
}

export async function downloadPublicationImages(
  imageUrls: string[] | null,
  existingHashes: Record<string, string> | null,
  existingPerceptualHashes: Record<string, string> | null = null
): Promise<PublicationImageDownloadResult> {
  const localHashes = { ...(existingHashes ?? {}) };
  const perceptualHashes = { ...(existingPerceptualHashes ?? {}) };
  if (!imageUrls?.length) return { localHashes, perceptualHashes };

  for (const remoteUrl of imageUrls) {
    const existingHash = localHashes[remoteUrl];
    if (existingHash && perceptualHashes[remoteUrl]) {
      const stored = await readStoredImage(existingHash);
      if (stored) continue;
    }

    const downloaded = await downloadImageToStore(remoteUrl);
    if (downloaded) {
      localHashes[remoteUrl] = downloaded.contentHash;
      perceptualHashes[remoteUrl] = downloaded.perceptualHash;
    }
  }

  return { localHashes, perceptualHashes };
}

export type PublicationStoredImageInput = {
  isActive: boolean;
  imageUrls: string[] | null;
  imageLocalHashes: Record<string, string> | null;
};

export async function publicationHasMissingStoredImages(
  publication: PublicationStoredImageInput
): Promise<boolean> {
  if (!publication.isActive || !publication.imageUrls?.length) {
    return false;
  }

  const localHashes = publication.imageLocalHashes;
  if (!localHashes || Object.keys(localHashes).length === 0) {
    return true;
  }

  for (const remoteUrl of publication.imageUrls) {
    const contentHash = localHashes[remoteUrl];
    if (!contentHash) return true;
    const stored = await readStoredImage(contentHash);
    if (!stored) return true;
  }

  return false;
}

export async function propertyHasMissingStoredImages(
  publications: readonly PublicationStoredImageInput[]
): Promise<boolean> {
  for (const publication of publications) {
    if (await publicationHasMissingStoredImages(publication)) {
      return true;
    }
  }
  return false;
}

export async function readStoredImage(
  contentHash: string
): Promise<{ filePath: string; extension: string } | null> {
  for (const extension of ["jpg", "jpeg", "png", "webp", "gif"]) {
    const filePath = localImagePath(contentHash, extension);
    try {
      await access(filePath);
      return { filePath, extension };
    } catch {
      continue;
    }
  }
  return null;
}
