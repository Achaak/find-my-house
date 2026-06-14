import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  backupAndRecreateProfile,
  isBrowserProfileInUseError,
  PROFILE_LOCK_MAX_ATTEMPTS,
  PROFILE_LOCK_RETRY_BASE_MS,
} from "./profileLock.js";

describe("isBrowserProfileInUseError", () => {
  it("detects profile lock errors", () => {
    expect(
      isBrowserProfileInUseError(
        new Error("Target page, context or browser has been closed")
      )
    ).toBe(true);
    expect(
      isBrowserProfileInUseError(
        new Error("Ouverture dans une session de navigateur existante.")
      )
    ).toBe(true);
    expect(
      isBrowserProfileInUseError(
        new Error(
          "CloakBrowser: profile already in use (/data/cloakbrowser-profile)."
        )
      )
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isBrowserProfileInUseError(new Error("HTTP 403"))).toBe(false);
  });
});

describe("profile lock retry tuning", () => {
  it("allows enough time for first-time CloakBrowser download", () => {
    const totalBackoffMs = Array.from(
      { length: PROFILE_LOCK_MAX_ATTEMPTS - 1 },
      (_, index) => (index + 2) * PROFILE_LOCK_RETRY_BASE_MS
    ).reduce((sum, delay) => sum + delay, 0);

    expect(PROFILE_LOCK_MAX_ATTEMPTS).toBeGreaterThanOrEqual(10);
    expect(totalBackoffMs).toBeGreaterThanOrEqual(5 * 60_000);
  });
});

describe("backupAndRecreateProfile", () => {
  it("creates a fresh profile directory", () => {
    const root = mkdtempSync(join(tmpdir(), "cloak-profile-"));
    const profileDir = join(root, "profile");

    const backupDir = backupAndRecreateProfile(profileDir);

    expect(existsSync(profileDir)).toBe(true);
    expect(backupDir).toBeNull();
    rmSync(root, { recursive: true, force: true });
  });
});
