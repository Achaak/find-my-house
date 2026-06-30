import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // createTestRepository() runs `prisma db push` synchronously per test file.
    testTimeout: 15_000,
  },
});
