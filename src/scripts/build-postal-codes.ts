import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPostalCodeIndex } from "../utils/geo/postalCodeIndex.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("geo:build-postal-codes");

const API_URL =
  "https://geo.api.gouv.fr/communes?fields=nom,codesPostaux,centre&format=json&geometry=centre";

type CommuneResponse = {
  nom: string;
  codesPostaux: string[];
  centre?: { coordinates: [number, number] };
};

async function main(): Promise<void> {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`geo.api.gouv.fr failed: HTTP ${String(response.status)}`);
  }

  const communes = (await response.json()) as CommuneResponse[];
  const index = buildPostalCodeIndex(communes);

  const outputPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "../data/postal-codes.json"
  );
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(index)}\n`, "utf8");

  const postalCodeCount = Object.keys(index).length;
  const multiCityCount = Object.values(index).filter(Array.isArray).length;
  log.info(
    `Wrote ${String(postalCodeCount)} postal codes (${String(multiCityCount)} shared) → ${outputPath}`
  );
}

main().catch((error: unknown) => {
  log.error("Failed to build postal code index:", error);
  process.exit(1);
});
