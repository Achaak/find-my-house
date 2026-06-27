import imghash from "imghash";

/** Max Hamming distance for near-duplicate photos (64-bit blockhash). */
export const PERCEPTUAL_DEDUP_THRESHOLD = 8;

export async function computePerceptualHash(buffer: Buffer): Promise<string> {
  return imghash.hash(buffer, 8, "hex");
}

export function perceptualHashDistance(left: string, right: string): number {
  const binLeft = imghash.hexToBinary(left);
  const binRight = imghash.hexToBinary(right);
  if (binLeft.length !== binRight.length) {
    return Math.max(binLeft.length, binRight.length);
  }

  let distance = 0;
  for (let i = 0; i < binLeft.length; i++) {
    if (binLeft[i] !== binRight[i]) distance++;
  }
  return distance;
}

export function arePerceptualHashesSimilar(
  left: string,
  right: string,
  threshold = PERCEPTUAL_DEDUP_THRESHOLD
): boolean {
  return perceptualHashDistance(left, right) <= threshold;
}

export function findSimilarPerceptualHash(
  target: string,
  candidates: readonly string[],
  threshold = PERCEPTUAL_DEDUP_THRESHOLD
): string | undefined {
  for (const candidate of candidates) {
    if (arePerceptualHashesSimilar(target, candidate, threshold)) {
      return candidate;
    }
  }
  return undefined;
}
