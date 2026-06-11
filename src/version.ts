import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | undefined;

export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;

  const pkgPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json"
  );
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };
  cachedVersion = pkg.version;
  return cachedVersion;
}

export function getBuildInfo(): { version: string; commit?: string } {
  return {
    version: getAppVersion(),
    commit: process.env.GIT_COMMIT,
  };
}

export function formatVersionLine(): string {
  const { version, commit } = getBuildInfo();
  const commitSuffix = commit ? ` (${commit.slice(0, 7)})` : "";
  return `v${version}${commitSuffix}`;
}
