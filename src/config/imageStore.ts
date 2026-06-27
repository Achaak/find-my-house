import { join } from "node:path";

export function imageStoreDir(): string {
  const configured = process.env.IMAGE_STORE_DIR?.trim();
  if (configured) return configured;
  return join(process.cwd(), "data", "images");
}

export function perceptualIndexPath(): string {
  return join(imageStoreDir(), "perceptual-index.json");
}
