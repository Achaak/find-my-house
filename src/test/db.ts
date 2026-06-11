import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ListingRepository } from "../db/listingRepository.js";
import { PrismaClient } from "../generated/prisma/client.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);

export function createTestRepository(): {
  repository: ListingRepository;
  prisma: PrismaClient;
  dispose: () => Promise<void>;
} {
  const dbPath = path.join(
    os.tmpdir(),
    `find-my-house-test-${String(process.pid)}-${String(Date.now())}.db`
  );
  const databaseUrl = `file:${dbPath}`;

  execSync(`pnpm exec prisma db push --url "${databaseUrl}"`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    cwd: projectRoot,
    stdio: "pipe",
  });

  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });
  const repository = new ListingRepository(prisma);

  return {
    repository,
    prisma,
    dispose: async () => {
      await prisma.$disconnect();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    },
  };
}
