import { existsSync, mkdirSync, renameSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const LOCK_FILES = ["SingletonLock", "SingletonSocket", "SingletonCookie"];

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Remove stale Chromium profile locks (safe when no browser uses the profile). */
export function clearStaleProfileLocks(profileDir: string): void {
  for (const name of LOCK_FILES) {
    try {
      unlinkSync(join(profileDir, name));
    } catch {
      // ignore missing or in-use locks
    }
  }
}

/** Move a broken profile aside and recreate an empty directory. */
export function backupAndRecreateProfile(profileDir: string): string | null {
  if (!existsSync(profileDir)) {
    mkdirSync(profileDir, { recursive: true });
    return null;
  }

  const backupDir = `${profileDir}.bak-${String(Date.now())}`;
  try {
    renameSync(profileDir, backupDir);
  } catch {
    rmSync(profileDir, { recursive: true, force: true });
  }

  mkdirSync(profileDir, { recursive: true });
  return backupDir;
}

export function isBrowserProfileInUseError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("target page, context or browser has been closed") ||
    message.includes("browser has been closed") ||
    message.includes("session de navigateur existante") ||
    message.includes("existing browser session") ||
    message.includes("process_singleton") ||
    message.includes("profile already in use") ||
    message.includes("user data directory") ||
    message.includes("singleton")
  );
}
