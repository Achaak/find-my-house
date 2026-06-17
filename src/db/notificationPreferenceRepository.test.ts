import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { NotificationPreferenceRepository } from "./notificationPreferenceRepository.js";
import { createTestRepository } from "../test/db.js";

describe("NotificationPreferenceRepository", () => {
  let dispose: (() => Promise<void>) | undefined;
  let repository: NotificationPreferenceRepository;

  beforeAll(() => {
    const testDb = createTestRepository();
    dispose = testDb.dispose;
    repository = new NotificationPreferenceRepository(testDb.prisma);
  });

  afterAll(async () => {
    await dispose?.();
  });

  it("defaults to enabled when no row exists", async () => {
    await expect(repository.getEnabled("ha:alice")).resolves.toBe(true);
    await expect(repository.shouldSendHouseholdNotifications()).resolves.toBe(
      true
    );
  });

  it("persists per-user preference", async () => {
    await repository.setEnabled("ha:alice", false);
    await expect(repository.getEnabled("ha:alice")).resolves.toBe(false);
    await expect(repository.getEnabled("ha:bob")).resolves.toBe(true);
  });

  it("skips household notifications when only explicit opt-outs exist", async () => {
    await repository.setEnabled("ha:alice", false);
    await expect(repository.shouldSendHouseholdNotifications()).resolves.toBe(
      false
    );
  });

  it("sends household notifications when at least one user opted in", async () => {
    await repository.setEnabled("ha:alice", false);
    await repository.setEnabled("ha:bob", true);
    await expect(repository.shouldSendHouseholdNotifications()).resolves.toBe(
      true
    );
  });
});
